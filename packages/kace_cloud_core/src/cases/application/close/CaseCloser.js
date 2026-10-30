import { DomainCaseFinder } from '../..';
import { CustomError } from '../../../shared/errors/CustomError';
import { EventLogger } from '../../../shared/EventLogger';
import { SubcasesOpenStatusService } from '../..';
import { GroupsFinder } from '../../../grupos/domain/GroupsFinder';
import { AgentCasesConfigFinder } from '../../../global-config/domain/AgentCasesConfigFinder.js';
export class CaseCloser {
    /**
     * @type {KnexCaseRepository}
     * is initialized in the constructor
     */
    #repository;
    /**
     * @type {DomainCaseFinder}
     * is initialized in the constructor
     */
    #finder;
    /**
     *
     * @param {KnexCaseRepository} repository
     */
    constructor(repository, groupsRepository, globalConfigurationRepository, subcaseRelationshipRepository) {
        this.#repository = repository;
        this.#finder = new DomainCaseFinder(repository);
        this.eventLogger = new EventLogger(repository);
        this.groupFinder = new GroupsFinder(groupsRepository);
        this.agentCasesConfigFinder = new AgentCasesConfigFinder(globalConfigurationRepository);
        this.subcasesOpenStatusService = new SubcasesOpenStatusService({
            subcaseRepo: subcaseRelationshipRepository,
        });
    }

    /**
     *
     * @param {string} id identificator for search case
     * @returns {Promise<void>}
     */
    async execute(id, body) {
        const kase = await this.#finder.execute(id);
        if (kase === null || kase.fecha_resolucion.value !== null) {
            throw new CustomError('The Case you are trying close does not exist', 404);
        }
        const grupo = await this.groupFinder.execute(kase.grupo_id.value);
        const assignmentConfig = await this.agentCasesConfigFinder.execute(grupo);
        const hasOpen = await this.subcasesOpenStatusService.hasOpenChildren(kase.id.value);

        const allow = !!assignmentConfig.allow_close_case_without_subcases;
        if (!allow && hasOpen) {
            throw new CustomError(
                'The case cannot be closed: it has open subcases, and the group configuration prohibits it.'
            );
        }

        const payload = {
            fecha_resolucion: new Date(),
            ...body,
        };

        const originalValues = kase.toJson();
        kase.update(payload);

        await this.#repository.update(kase);
        await this.#repository.saveHistory(kase, originalValues);

        await this.eventLogger.log(
            'case.closed',
            id,
            kase.updated_by.value,
            kase.changedAttributes,
            id,
            kase.cliente_id.value,
            {
                fecha_resolucion: originalValues.fecha_resolucion,
                motivo_baja: originalValues.motivo_baja,
                transicion_id: originalValues.transicion_id,
                update_source: originalValues.update_source,
            }
        );
        kase.flushChanges();
    }
}
