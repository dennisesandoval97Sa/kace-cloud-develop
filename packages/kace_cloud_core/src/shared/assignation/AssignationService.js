import { AssignationsEnum } from '../domain/enum/AssignationsEnum';
import { CustomError } from '../errors/CustomError.js';
import { CASE_ASSIGNMENT_GROUP_UNAVAILABLE } from '@kace/error-codes';
import { EquivalentAssignmentService } from './EquivalentAssignmentService';
import { GroupsFinder } from '../../grupos/domain/GroupsFinder';
import { GlobalConfigFinder } from '../../global-config/domain/GlobalConfigFinder.js';
import { Groups } from '../../grupos/domain/Groups.js';
import { WorkQueueService } from './WorkQueueService';
import { Helper } from '../infrastructure/utils/Helper.js';
import { ValidationFailError } from '../errors/ValidationFailError.js';

export class AssignationService {
    /**
     * Creates an instance of AsignacionService.
     *
     * @param {KnexGroupsRepository} grupoRepository - Repository for querying group-related data.
     * @param {KnexGlobalConfigurationRepository} globalConfigurationRepository - Repository for querying global configuration data.
     * @param {KnexUsersRepository} usuarioRepository - Repository for querying user-related data.
     */
    constructor(grupoRepository, globalConfigurationRepository, usuarioRepository) {
        this.globalConfigurationRepository = globalConfigurationRepository;
        this.groupFinder = new GroupsFinder(grupoRepository);
        this.globalConfigFinder = new GlobalConfigFinder(globalConfigurationRepository);
        this.colaTrabajoService = new WorkQueueService(usuarioRepository);
        this.asignacionEquivalenteService = new EquivalentAssignmentService(usuarioRepository);
        /** @type {Map<string, Groups>} */
        this.#groupCache = new Map();
        /** @type {Map<string, Object>} */
        this.#configCache = new Map();
    }

    /** @type {Map<string, Groups>} */
    #groupCache;
    /** @type {Map<string, Object>} */
    #configCache;

    /**
     * Executes the appropriate assignment logic for a given group ID based on the assignment type.
     *
     * @async
     * @param {string} grupoId - The ID of the group for which the assignment logic should be executed.
     * @param workQueueConfigurations
     * @returns {Promise<String|null>} - The result of the assigned service, either `WorkQueueService` or `EquivalentAssignmentService`.
     * If no valid assignment type is found, it returns `null`.
     */
    async execute(grupoId, caseId = null) {
        Helper.logDebug(`[AssignationService] Execute for group: ${grupoId}`);
        const grupo = await this.#getCachedGroup(grupoId);
        if (!this.#isGroupActive(grupo)) {
            return null;
        }
        const assignmentConfig = await this.#getCachedConfig(grupo);
        const assignationType = this.#getAssignationType(assignmentConfig);

        if (assignationType === AssignationsEnum.COLA_DE_TRABAJO.value) {
            const result = await this.colaTrabajoService.execute(grupo, assignmentConfig, caseId);
            Helper.logDebug(`[AssignationService] Work queue responsible: ${result}`);
            return result;
        }
        if (assignationType === AssignationsEnum.ASIGNACION_EQUIVALENTE.value) {
            const result = await this.asignacionEquivalenteService.execute(grupo);
            Helper.logDebug(`[AssignationService] Equivalent assignment responsible: ${result}`);
            return result;
        }

        throw new Error(`Invalid assignation type: ${assignationType} for the group ${grupoId}`);
    }

    /**
     * Executes assignment, throwing 422 if the target group does not exist or is unavailable.
     *
     * @async
     * @param {string} grupoId
     * @param {string|null} [caseId=null]
     * @returns {Promise<String|null>}
     */
    async executeOrFail(grupoId, caseId = null) {
        const grupo = await this.#getCachedGroup(grupoId);
        if (!this.#isGroupActive(grupo)) {
            throw new CustomError(
                'The group you are trying to assign does not exist or is unavailable.',
                422,
                ['grupoId'],
                CASE_ASSIGNMENT_GROUP_UNAVAILABLE
            );
        }
        return this.execute(grupoId, caseId);
    }

    /**
     * Verifies if a group instance is active and not soft-deleted.
     * Handles domain aggregate Groups (with isActive()) as well as plain objects/stubs.
     * @private
     * @param {Object|null} grupo
     * @returns {boolean}
     */
    #isGroupActive(grupo) {
        return Boolean(grupo?.isActive?.());
    }

    /**
     * Returns the cached group, fetching it once per groupId per service instance.
     * @private
     * @param {string} grupoId
     * @returns {Promise<Groups>}
     */
    async #getCachedGroup(grupoId) {
        if (!this.#groupCache.has(grupoId)) {
            this.#groupCache.set(grupoId, await this.groupFinder.execute(grupoId));
        }
        return this.#groupCache.get(grupoId);
    }

    /**
     * Returns the cached assignment config, fetching the global config once per configuration_id.
     * @private
     * @param {Groups} grupo
     * @returns {Promise<Object>}
     */
    async #getCachedConfig(grupo) {
        const configId = grupo.configuration_id?.value;
        if (!this.#configCache.has(configId)) {
            this.#configCache.set(configId, await this.#getAssignmentConfig(grupo));
        }
        return this.#configCache.get(configId);
    }

    /**
     * Retrieves the assignment configuration from the group or the global configuration.
     * @private
     * @param {Groups} grupo - The group object from which to determine the assignment type.
     * @returns {Promise<Object>}
     */
    async #getAssignmentConfig(grupo) {
        if (!grupo.configuration_id.value) {
            Helper.logError(`${this.name}: Group configuration_id is required: ${grupo.id.value}`);
            throw ValidationFailError('Group configuration_id is required', 'configuration_id');
        }

        try {
            const globalConfiguration = await this.globalConfigFinder.execute(grupo.configuration_id.value);
            const behavioursAgentCases = globalConfiguration.settings?.behaviors?.getConfig('agente', 'casos');
            const assignmentActiveSessionLimit = behavioursAgentCases?.assignment_active_session_limit;

            return {
                ...behavioursAgentCases,
                active_session_limit:
                    Number.isInteger(assignmentActiveSessionLimit) && assignmentActiveSessionLimit > 0
                        ? assignmentActiveSessionLimit
                        : 2,
            };
        } catch (error) {
            Helper.logError(`[AssignationService] Error getting config for group ${grupo?.id?.value}:`, error);
            return {};
        }
    }

    /**
     * Extracts the assignment type from the behaviors.
     * @private
     * @param {Object} behaviours
     * @returns {string}
     */
    #getAssignationType(behaviours) {
        if (behaviours.type_assignment) {
            return AssignationsEnum.fromValue(behaviours.type_assignment).value;
        }

        return AssignationsEnum.COLA_DE_TRABAJO.value;
    }
}
