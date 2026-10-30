import { Helper, Criteria } from '../../../shared';

export class FinderByTrigger {
    /** @type {KnexActionRepository} */
    #actionRepository; // is initialized in the constructor

    constructor(actionRepository) {
        this.#actionRepository = actionRepository;
    }

    /**
     * @param {string} trigger
     * @param {Object} [options]
     * @param {Object} [options.actionTypeFilter]
     * @param {string[]} [options.actionTypeFilter.include]
     * @param {string[]} [options.actionTypeFilter.exclude]
     * @param {('case'|'user'|'group')} [options.entityFilter] — restrict to actions whose `entity` column equals this value.
     *
     * @returns {Promise<Action[]>}
     */
    async execute(trigger, options = {}) {
        try {
            const filtersList = [
                { field: 'triggers', operator: 'jsonArrayValue', value: [trigger], type: 'AND' },
                { field: 'is_active', operator: 'eq', value: true, type: 'AND' },
                { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
            ];

            const { actionTypeFilter, entityFilter } = options;

            if (entityFilter !== undefined) {
                filtersList.push({
                    field: 'entity',
                    operator: 'eq',
                    value: entityFilter,
                    type: 'AND',
                });
            }

            if (actionTypeFilter?.include?.length) {
                filtersList.push({
                    field: 'action_type',
                    operator: 'in',
                    value: actionTypeFilter.include,
                    type: 'AND',
                });
            }

            if (actionTypeFilter?.exclude?.length) {
                filtersList.push({
                    field: 'action_type',
                    operator: 'notIn',
                    value: actionTypeFilter.exclude,
                    type: 'AND',
                });
            }

            const criteria = new Criteria(
                filtersList,
                null,
                null,
                null,
                { field: 'priority', direction: 'asc' },
                'actions'
            );

            Helper.logDebug('FinderByTrigger:execute:params', trigger, options);

            return this.#actionRepository.search(criteria);
        } catch (error) {
            Helper.logError(`Error find trigger ${trigger}:`, error);
        }
    }
}
