import { Helper, KnexRepository, QueryDBError } from '../../../shared';
import { ActionsQueueExecutions } from '../../domain/ActionsQueueExecutions';

export class KnexActionsQueueExecutionsRepository extends KnexRepository {
    constructor(config) {
        super(config, 'actions_queue_executions');
    }

    /**
     * Create a new ActionsQueueExecutions record in the database
     *
     * @param {ActionsQueueExecutions} ActionsQueueExecutions - The ActionsQueueExecutions object to be created
     * @throws {QueryDBError} If there is an error during the database operation
     */
    async save(ActionsQueueExecutions) {
        const {
            id,
            action_id,
            case_id,
            client_id,
            status,
            trigger_type,
            start_execution,
            end_execution,
            created_at,
            created_by,
        } = ActionsQueueExecutions;

        try {
            await this.table().insert({
                id: id.value,
                action_id: action_id.value,
                case_id: case_id.value,
                client_id: client_id.value,
                status: status.value,
                trigger_type: trigger_type.value,
                start_execution: start_execution.value,
                end_execution: end_execution.value,
                created_at: created_at.value,
                created_by: created_by.value,
            });
        } catch (error) {
            Helper.logError('Error creating ActionsQueueExecutions', error);
            throw new QueryDBError('Error creating ActionsQueueExecutions', error);
        }
    }

    async find(id) {
        try {
            const result = await this.table().where({ id: id.value, deleted_at: null }).first();

            if (!result) {
                return null;
            }

            return ActionsQueueExecutions.create(result);
        } catch (error) {
            Helper.logError('Error fetching ActionsQueueExecutions', error);
            throw new QueryDBError('Error fetching ActionsQueueExecutions', error);
        }
    }

    /**
     * Find all ActionsQueueExecutions records in the database that match the given filters
     *
     * @param {Object} filters - An object containing the filters to apply to the query
     * @returns {Promise<ActionsQueueExecutions[]>} List of ActionsQueueExecutions objects
     */
    async findByFilters(filters = {}) {
        try {
            const queryBuilder = this.table().where('deleted_at', null);

            Object.entries(filters).forEach(([key, value]) => {
                queryBuilder.where(key, value);
            });

            queryBuilder.select('*').orderBy('created_at', 'asc');

            const queryResults = await queryBuilder;

            return queryResults.map((result) => ActionsQueueExecutions.create(result));
        } catch (error) {
            Helper.logError('Error fetching actions queue executions', error);
            return [];
        }
    }

    /**
     * Update a ActionsQueueExecutions record in the database
     *
     * @param {ActionsQueueExecutions} ActionsQueueExecutions - The ActionsQueueExecutions object to be updated
     * @throws {QueryDBError} If there is an error during the database operation
     */
    async update(ActionsQueueExecutions) {
        try {
            await this.table()
                .where({ id: ActionsQueueExecutions.id.value })
                .update(ActionsQueueExecutions.changedAttributes);
        } catch (error) {
            Helper.logError('Error updating rest workflow step', error);
            throw new QueryDBError('update', 'Error updating ActionsQueueExecutions');
        }
    }
}
