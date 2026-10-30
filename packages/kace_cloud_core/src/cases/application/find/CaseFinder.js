import { DomainCaseFinder } from '../..';
import { CustomError, Helper } from '../../../shared';
import { EventLogger } from '../../../shared/EventLogger';
import { CaseResponse } from '../CaseResponse';
import { CaseResponseAllRelations } from '../CaseResponseAllRelations';

export class CaseFinder {
    /**
     * @type {DomainCaseFinder}
     * is initialized in the constructor
     */
    #finder;

    /** @type {import('../../../users').User} is initialized in the constructor */
    #currentUser;

    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexCaseRepository} repository
     * @param {import('../../../users').User} currentUser - The currently authenticated user object.
     */
    constructor(repository, currentUser) {
        this.#repository = repository;
        this.#finder = new DomainCaseFinder(repository);
        this.eventLogger = new EventLogger(repository);
        this.#currentUser = currentUser;
    }

    /**
     * Registra la primera vista del responsable sobre el caso si corresponde.
     * Idempotente y a prueba de fallos: nunca interrumpe la lectura.
     * @param {import('../../domain/Case').Case} kase - El caso sobre el cual registrar la primera vista.
     * @returns {Promise<void>} No retorna valor; los fallos se registran sin propagarse.
     * @private
     */
    async #recordFirstViewIfResponsible(kase) {
        try {
            const userId = this.#currentUser?.id?.value;
            if (!userId || userId !== kase.responsable_id.value || kase.first_view_at.value != null) {
                return;
            }

            const originalValues = kase.toJson();
            kase.first_view_at = new Date();
            await this.#repository.update(kase);
            await this.#repository.saveHistory(kase, originalValues);
        } catch (error) {
            Helper.logError(error);
        }
    }

    /**
     * Busca un caso por su identificador y devuelve su representación de respuesta.
     * Opcionalmente registra el evento de visualización y la primera vista del responsable.
     * @param {string} id - Identificador del caso a buscar.
     * @param {boolean} [logEvent=true] - Indica si se debe registrar el evento `case.viewed`.
     * @returns {Promise<CaseResponse>} La representación del caso encontrado.
     * @throws {CustomError} Con estado 404 si el caso no existe o está eliminado.
     */
    async execute(id, logEvent = true) {
        const kase = await this.#finder.execute(id);
        if (!kase || kase.isDeleted()) {
            throw new CustomError('case not found', 404);
        }

        if (logEvent) {
            await this.eventLogger.log(
                'case.viewed',
                id,
                this.#currentUser.id.value,
                kase.toJson(),
                id,
                kase.cliente_id.value
            );
            await this.#recordFirstViewIfResponsible(kase);
        }

        return new CaseResponse(kase);
    }

    async executeWithAllRelations(id, logEvent = true) {
        await this.execute(id, logEvent);
        const kase = await this.#finder.executeWithAllRelations(id);
        return new CaseResponseAllRelations(kase);
    }
}
