import { KnexCaseRepository } from '../infrastructure/persistence/KnexCaseRepository.js';
import { InvalidArgumentError } from '../../shared/index.js';
import { UpdateSLATimers } from '../../shared/domain/services/UpdateSLATimers.js';
import { DomainCaseFinder } from '../index.js';
import { ValueObjectAssignmentChangeType } from '../domain/ValueObjectAssignmentChangeType.js';

export default class CaseUserAssignmentService {
    /** @type {KnexCaseRepository} */
    #caseRepository;

    /**
     *
     * @param {KnexCaseRepository} caseRepository
     */
    constructor(caseRepository) {
        this.#ensureValidParams(caseRepository);

        this.#caseRepository = caseRepository;
        this.finder = new DomainCaseFinder(caseRepository);
    }

    /**
     * Reasigna responsable y grupo para un caso existente.
     *
     * NOTA DE AUDITORÍA: Este servicio es un colaborador de dominio interno utilizado
     * exclusivamente por ejecutores de acciones automáticas (actions/domain/types/*),
     * tales como asignaciones por reglas o disparadores de sistema, sin sesión de usuario
     * interactiva. Por diseño, NO muta edited_at ni edited_by para preservar la trazabilidad
     * y autoría de la última edición humana interactiva sobre el caso.
     *
     * @param {import('../domain/Case').Case} kase
     * @param { string }userId
     * @param { string }groupId
     * @param { string }changeType
     */
    async execute(kase, userId, groupId, changeType = ValueObjectAssignmentChangeType.MANUAL) {
        const originalValues = kase.toJson();

        kase.responsable_id = userId;
        kase.grupo_id = groupId;
        kase.updated_by = kase.updated_by.value || kase.created_by.value;
        kase.updated_at = new Date();
        kase.assignment_change_type = changeType;

        await this.#caseRepository.update(kase);
        await this.#caseRepository.saveHistory(kase, originalValues);

        await this.updateSlaTimers(kase);
    }

    /**
     *
     * @param {Case} kase
     * @return {Promise<void>}
     */
    async updateSlaTimers(kase) {
        const {
            kase: kaseForAns,
            caseAns,
            shiftManagement,
            stateAns,
            globalConfig,
        } = await this.finder.executeForAns(kase.id.value);

        const originalValues = kaseForAns.toJson();

        const slaUpdater = new UpdateSLATimers(kaseForAns, shiftManagement, caseAns, stateAns, globalConfig);
        await slaUpdater.execute();

        await this.#caseRepository.update(kaseForAns);

        await this.#caseRepository.saveHistory(kaseForAns, originalValues);
    }

    #ensureValidParams(caseRepository) {
        if (caseRepository instanceof KnexCaseRepository) return;

        throw new InvalidArgumentError('Invalid case repository');
    }
}
