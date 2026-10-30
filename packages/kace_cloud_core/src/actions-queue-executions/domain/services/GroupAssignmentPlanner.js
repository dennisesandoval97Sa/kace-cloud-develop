import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { ActionTypes } from '../../../actions/domain/ActionTypes.js';
import { ExternalCodeGroupResolver } from './ExternalCodeGroupResolver.js';

export class GroupAssignmentPlanner {
    /**
     * @param {CaseActionValidator} caseActionValidator
     * @param {Object} dependencies
     * @param {Object} [dependencies.userListsRepository]
     * @param {Object} [dependencies.groupsRepository]
     * @param {Object} [dependencies.caseFindAllActiveService]
     * @param {number} [concurrencyLimit=50]
     */
    constructor(
        caseActionValidator,
        { userListsRepository, groupsRepository, caseFindAllActiveService } = {},
        concurrencyLimit = 50
    ) {
        this.caseActionValidator = caseActionValidator;
        this.userListsRepository = userListsRepository;
        this.groupsRepository = groupsRepository;
        this.caseFindAllActiveService = caseFindAllActiveService;
        this.concurrencyLimit = concurrencyLimit;
        this.externalCodeGroupResolver = new ExternalCodeGroupResolver(this.groupsRepository);
    }

    /**
     * Plans executable operations for group-assignment actions.
     *
     * Rules:
     * - Input cases are only candidate cases.
     * - If group context enables critical ordering (work_queue_sorting_rules),
     *   planner intentionally ignores candidate cases and reloads all active cases from DB,
     *   already ordered by context settings.
     * - If the target group exists in the work queue capacity context, limit the successful operations by capacity.
     * - If the target group does not exist in the work queue capacity context, process normally.
     * - For current-group assignment, capacity is applied independently per current group.
     *
     * @param {Object} params
     * @param {Array<Object>} params.actions
     * @param {Array<Object>} [params.candidateCases]
     * @param {Array<Object>} [params.cases] legacy alias for candidateCases
     * @param {Array<Object>} params.workQueueCapacityContext
     * @returns {Promise<{successOperations: Array, failedOperations: Array, errorOperations: Array}>}
     */
    async plan({ actions, candidateCases, cases, workQueueCapacityContext = [] }) {
        const resolvedCandidateCases = Array.isArray(candidateCases) ? candidateCases : cases || [];
        const aggregatedResult = this.#createEmptyResult();
        const groupCapacityMap = this.#buildCapacityMap(workQueueCapacityContext);

        Helper.logDebug(
            `GroupAssignmentPlanner::plan actions=${actions?.length || 0}, candidateCases=${resolvedCandidateCases.length}, groupCapacityConfigs=${groupCapacityMap.size}`
        );

        for (const action of actions) {
            try {
                const actionResult = await this.#planForAction({
                    action,
                    candidateCases: resolvedCandidateCases,
                    groupCapacityMap,
                });

                this.#mergeResults(aggregatedResult, actionResult);
            } catch (error) {
                Helper.logError(`Error planning group assignment action ${action?.id?.value}`, error);
                aggregatedResult.errorOperations.push({
                    action,
                    error,
                    attempts: 0,
                });
            }
        }

        Helper.logDebug(
            `GroupAssignmentPlanner::planResult success=${aggregatedResult.successOperations.length}, failed=${aggregatedResult.failedOperations.length}, errors=${aggregatedResult.errorOperations.length}`
        );

        return aggregatedResult;
    }

    async #planForAction({ action, candidateCases, groupCapacityMap }) {
        const actionType = action?.action_type?.value;

        switch (actionType) {
            case ActionTypes.ASIGNAR_LISTA_ASESORES.value:
                return this.#planListAssignmentAction({ action, candidateCases, groupCapacityMap });

            case ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value:
                return this.#planExternalCodeGroupAssignmentAction({ action, candidateCases, groupCapacityMap });

            case ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value:
                return this.#planCurrentGroupAssignmentAction({ action, candidateCases, groupCapacityMap });

            default:
                return this.#validateAllCasesForAction(candidateCases, action);
        }
    }

    async #planListAssignmentAction({ action, candidateCases, groupCapacityMap }) {
        try {
            if (!action.advisor_list_id?.value) {
                return this.#buildActionErrorResult(
                    action,
                    new Error('Missing advisor list id in action'),
                    candidateCases
                );
            }

            const list = await this.userListsRepository.find(action.advisor_list_id);

            if (!list) {
                return this.#buildActionErrorResult(
                    action,
                    new Error(`List ${action.advisor_list_id.value} not found`),
                    candidateCases
                );
            }

            const groupId = list.group_id?.value;

            if (!groupId) {
                return this.#buildActionErrorResult(
                    action,
                    new Error(`List ${action.advisor_list_id.value} has no group_id`),
                    candidateCases
                );
            }

            return await this.#planForResolvedGroup({
                action,
                candidateCases,
                targetGroupId: String(groupId),
                groupCapacityMap,
            });
        } catch (error) {
            Helper.logError(`Error resolving list assignment for action ${action?.id?.value}`, error);
            const result = this.#createEmptyResult();
            candidateCases.forEach((activeCase) => {
                result.errorOperations.push({ case: activeCase, action, error, attempts: 0 });
            });
            return result;
        }
    }

    async #planExternalCodeGroupAssignmentAction({ action, candidateCases, groupCapacityMap }) {
        try {
            if (!action.external_group_code?.value) {
                return this.#buildActionErrorResult(
                    action,
                    new Error('Missing external group code in action'),
                    candidateCases
                );
            }

            const externalCode = action.external_group_code.value;
            const groupId = await this.externalCodeGroupResolver.resolve(externalCode);

            if (!groupId) {
                return this.#buildActionErrorResult(
                    action,
                    new Error(`Group not found for external code ${externalCode}`),
                    candidateCases
                );
            }

            return await this.#planForResolvedGroup({
                action,
                candidateCases,
                targetGroupId: String(groupId),
                groupCapacityMap,
            });
        } catch (error) {
            Helper.logError(`Error resolving external code assignment for action ${action?.id?.value}`, error);
            const result = this.#createEmptyResult();
            candidateCases.forEach((activeCase) => {
                result.errorOperations.push({ case: activeCase, action, error, attempts: 0 });
            });
            return result;
        }
    }

    async #planCurrentGroupAssignmentAction({ action, candidateCases, groupCapacityMap }) {
        try {
            const result = this.#createEmptyResult();
            const casesByCurrentGroup = this.#groupCasesByCurrentGroup(candidateCases);

            for (const [groupId, groupCases] of casesByCurrentGroup.entries()) {
                try {
                    const partialResult = await this.#planForResolvedGroup({
                        action,
                        candidateCases: groupCases,
                        targetGroupId: groupId,
                        groupCapacityMap,
                        filterByTargetGroup: true,
                    });

                    this.#mergeResults(result, partialResult);
                } catch (error) {
                    Helper.logError(`Error planning group ${groupId} for action ${action?.id?.value}`, error);

                    groupCases.forEach((activeCase) => {
                        result.errorOperations.push({ case: activeCase, action, error, attempts: 0 });
                    });
                }
            }

            return result;
        } catch (error) {
            Helper.logError(`Error resolving current group assignment for action ${action?.id?.value}`, error);
            return this.#buildActionErrorResult(action, error, candidateCases);
        }
    }

    async #planForResolvedGroup({
        action,
        candidateCases,
        targetGroupId,
        groupCapacityMap,
        filterByTargetGroup = false,
    }) {
        const groupCapacityConfig = groupCapacityMap.get(String(targetGroupId));

        if (!groupCapacityConfig) {
            return this.#validateAllCasesForAction(candidateCases, action);
        }

        if (groupCapacityConfig.capacidad <= 0) {
            Helper.logDebug(
                `GroupAssignmentPlanner::group ${targetGroupId} has zero capacity for action ${action?.id?.value}`
            );
            return this.#createEmptyResult();
        }

        const casesToValidate = await this.#resolveCasesForGroupAction({
            candidateCases,
            targetGroupId,
            groupCapacityConfig,
            filterByTargetGroup,
        });

        if (casesToValidate.length === 0 && candidateCases.length > 0) {
            Helper.logDebug(
                `GroupAssignmentPlanner::no cases to validate for action ${action?.id?.value} on group ${targetGroupId} despite having candidate cases`
            );
        }

        return this.#collectValidCasesUntilCapacity(casesToValidate, action, groupCapacityConfig.capacidad);
    }

    async #resolveCasesForGroupAction({ candidateCases, targetGroupId, groupCapacityConfig, filterByTargetGroup }) {
        if (!this.#shouldOrderCasesForGroup(groupCapacityConfig)) {
            return candidateCases;
        }

        if (!this.caseFindAllActiveService) {
            return candidateCases;
        }

        const filters = { 'cases.fecha_resolucion': null };
        if (filterByTargetGroup) {
            filters['cases.grupo_id'] = targetGroupId;
        }

        try {
            const normalizedRules = this.#getSortingRules(groupCapacityConfig);
            const orderedCases = await this.caseFindAllActiveService.execute(filters, {
                work_queue_sorting_rules: normalizedRules,
            });

            return Array.isArray(orderedCases) ? orderedCases : candidateCases;
        } catch (error) {
            Helper.logError(`Error loading ordered cases for group ${targetGroupId}`, error);
            return candidateCases;
        }
    }

    #shouldOrderCasesForGroup(groupCapacityConfig) {
        return this.#getSortingRules(groupCapacityConfig).length > 0;
    }

    async #validateAllCasesForAction(cases, action) {
        const result = this.#createEmptyResult();

        for (let i = 0; i < cases.length; i += this.concurrencyLimit) {
            const batch = cases.slice(i, i + this.concurrencyLimit);

            const validations = await Promise.all(
                batch.map((activeCase) =>
                    this.caseActionValidator
                        .validate(activeCase, action)
                        .then((isValid) => ({ isValid, activeCase }))
                        .catch((error) => {
                            Helper.logError(
                                `Error validating action ${action?.id?.value} for case ${activeCase?.id?.value}`,
                                error
                            );

                            return { isValid: false, activeCase, error };
                        })
                )
            );

            for (const { isValid, activeCase, error } of validations) {
                const operation = { case: activeCase, action };

                if (isValid) {
                    result.successOperations.push(operation);
                    continue;
                }

                if (error) {
                    result.errorOperations.push({ ...operation, error, attempts: 0 });
                } else {
                    result.failedOperations.push({ ...operation, attempts: 0 });
                }
            }
        }

        return result;
    }

    async #collectValidCasesUntilCapacity(cases, action, capacity) {
        const result = this.#createEmptyResult();
        let successCount = 0;

        for (const activeCase of cases) {
            if (successCount >= capacity) {
                break;
            }

            try {
                const isValid = await this.caseActionValidator.validate(activeCase, action);
                const operation = { case: activeCase, action };

                if (isValid) {
                    result.successOperations.push(operation);
                    successCount++;
                }
            } catch (error) {
                Helper.logError(
                    `Error validating action ${action?.id?.value} for case ${activeCase?.id?.value}`,
                    error
                );
                result.errorOperations.push({ case: activeCase, action, error, attempts: 0 });
            }
        }

        return result;
    }

    #buildCapacityMap(workQueueCapacityContext) {
        const map = new Map();

        for (const item of workQueueCapacityContext) {
            const workQueueSortingRules = this.#getSortingRules(item);

            map.set(String(item.grupo_id), {
                grupo_id: String(item.grupo_id),
                capacidad: Math.max(0, Number(item.capacidad || 0)),
                work_queue_sorting_rules: workQueueSortingRules,
                max_cases_per_user: item.max_cases_per_user,
                activeUsers_filter_bool: item.activeUsers_filter_bool,
            });
        }

        return map;
    }

    #groupCasesByCurrentGroup(cases) {
        const groupedCases = new Map();

        for (const caseItem of cases) {
            const groupId = caseItem?.grupo_id?.value || caseItem?.grupo_id;
            if (!groupId) {
                continue;
            }

            const normalizedGroupId = String(groupId);

            if (!groupedCases.has(normalizedGroupId)) {
                groupedCases.set(normalizedGroupId, []);
            }

            groupedCases.get(normalizedGroupId).push(caseItem);
        }

        return groupedCases;
    }

    #buildActionErrorResult(action, error, cases = []) {
        if (cases && cases.length > 0) {
            return {
                successOperations: [],
                failedOperations: [],
                errorOperations: cases.map((activeCase) => ({ case: activeCase, action, error, attempts: 0 })),
            };
        }

        return {
            successOperations: [],
            failedOperations: [],
            errorOperations: [{ action, error, attempts: 0 }],
        };
    }

    #createEmptyResult() {
        return {
            successOperations: [],
            failedOperations: [],
            errorOperations: [],
        };
    }

    #mergeResults(target, source) {
        target.successOperations.push(...source.successOperations);
        target.failedOperations.push(...source.failedOperations);
        target.errorOperations.push(...source.errorOperations);
    }

    #getSortingRules(config) {
        return Array.isArray(config?.work_queue_sorting_rules)
            ? config.work_queue_sorting_rules.filter((rule) => rule?.assign_strategy && rule?.order_type)
            : [];
    }
}
