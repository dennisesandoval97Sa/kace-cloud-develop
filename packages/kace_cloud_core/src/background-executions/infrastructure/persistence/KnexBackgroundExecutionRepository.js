import { Helper, QueryDBError } from '../../../shared/index.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { BackgroundExecution } from '../../domain/BackgroundExecution.js';
import { ValueObjectProccessDescription } from '../../domain/value-objects/ValueObjectProccessDescription.js';

export class KnexBackgroundExecutionRepository extends KnexRepository {
    constructor(config) {
        super(config, 'background_executions');
    }

    /**
     * Saves a new Background Execution in the database.
     * @param {BackgroundExecution} background_execution
     * @returns {Promise<void>}
     */
    async save(background_execution) {
        try {
            await this.table().insert({
                id: background_execution.id.value,
                proccess_description: background_execution.proccess_description.value,
                execution_status: background_execution.execution_status.value,
                updated_at: background_execution.updated_at.value,
                updated_by: background_execution.updated_by.value,
                deleted_at: background_execution.deleted_at.value,
                deleted_by: background_execution.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving Background Execution:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a Background Execution by id.
     * @param {ValueObjectUuid} id
     * @returns {Promise<BackgroundExecution | null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();

            return result ? new BackgroundExecution(result) : null;
        } catch (error) {
            Helper.logError('Error finding Background Execution:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds a Background Execution by process description.
     * @param {ValueObjectProccessDescription} process_description
     * @returns {Promise<BackgroundExecution | null>}
     */
    async findByProcess(process_description) {
        try {
            const result = await this.table().where({ proccess_description: process_description.value }).first();

            return result ? new BackgroundExecution(result) : null;
        } catch (error) {
            Helper.logError('Error finding Background Execution:', error);
            throw new QueryDBError('findByProccess');
        }
    }

    /**
     * Searches for `BackgroundExecution` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<BackgroundExecution[]>} A promise that resolves to an array of `BackgroundExecution` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.table().select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            return rows.map((row) => new BackgroundExecution(row));
        } catch (error) {
            Helper.logError('Error searching Background Execution:', error);
            throw new QueryDBError('search');
        }
    }
}
