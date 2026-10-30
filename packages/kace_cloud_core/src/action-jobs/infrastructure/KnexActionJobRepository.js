import { ActionJob } from '../index.js';
import { KnexRepository, QueryDBError } from '../../shared/index';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';

export class KnexActionJobRepository extends KnexRepository {
    constructor(config) {
        super(config, 'action_jobs');
    }

    /**
     * Saves a new ActionJob record in the database.
     * @param {ActionJob} updateModel
     * @returns {Promise<void>}
     */
    async save(updateModel) {
        try {
            const result = await this.table()
                .insert({
                    id: updateModel.id.value,
                    type: updateModel.type.value,
                    is_pending: updateModel.is_pending.value,
                    is_in_progress: updateModel.is_in_progress.value,
                    is_completed: updateModel.is_completed.value,
                    action_id: updateModel.action_id.value,
                    search_filter: updateModel.search_filter.value,
                    s3_file_key: updateModel.s3_file_key.value,
                    total_records: updateModel.total_records.value,
                    processed_records: updateModel.processed_records.value,
                    failed_records: updateModel.failed_records.value,
                    details: JSON.stringify(updateModel.details.value),
                    notifications_sent: updateModel.notifications_sent.value,
                    start_at: updateModel.start_at.value,
                    end_at: updateModel.end_at.value,
                    restflow_id: updateModel.restflow_id.value,
                    restflow_context: updateModel.restflow_context.value,
                    created_at: updateModel.created_at.value,
                    created_by: updateModel.created_by.value,
                })
                .returning('*');
            return result ? new ActionJob(result[0]) : null;
        } catch (error) {
            Helper.logError('Error saving ActionJob:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a ActionJob record by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<ActionJob | null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();

            return result ? new ActionJob(result) : null;
        } catch (error) {
            Helper.logError('Error finding ActionJob:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds a ActionJob by actionId.
     * @param {ValueObjectUuid} actionId
     * @returns {Promise<ActionJob | null>}
     */
    async findByActionId(actionId) {
        try {
            const result = await this.table().where({ action_id: actionId.value }).first();

            return result ? new ActionJob(result) : null;
        } catch (error) {
            Helper.logError('Error finding ActionJob by actionId:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for pending batches for processing
     * @returns {Promise<ActionJob | null>}
     */
    async findPending() {
        try {
            const result = await this.table()
                .where({ is_pending: true, is_in_progress: false, is_completed: false })
                .whereNull('deleted_at')
                .orderBy('created_at', 'asc')
                .first();

            return result ? new ActionJob(result) : null;
        } catch (error) {
            Helper.logError('Error finding ActionJob pending:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for ActionJob instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<ActionJob[]>} A promise that resolves to an array of ActionJob instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.table().select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new ActionJob(row));
        } catch (error) {
            Helper.logError('Error searching ActionJobs:', error);
            throw new QueryDBError('search');
        }
    }
}
