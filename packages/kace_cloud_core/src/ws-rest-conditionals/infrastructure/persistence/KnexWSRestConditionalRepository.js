import { WSRestConditional } from '../../domain/WSRestConditional.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class KnexWSRestConditionalRepository extends KnexRepository {
    constructor(config) {
        super(config, 'ws_rest_conditionals');
    }

    /**
     * Saves a new WS REST endpoint in the database.
     * @param {WSRestConditional} conditional
     * @returns {Promise<void>}
     */
    async save(conditional) {
        try {
            const data = {
                id: conditional.id.value,
                satisfied: conditional.satisfied.value,
                unsatisfied: conditional.unsatisfied.value,
                operator: conditional.operator.value,
                input_path_a: conditional.input_path_a.value,
                input_path_b: conditional.input_path_b.value,
                created_at: conditional.created_at.value,
                created_by: conditional.created_by.value,
            };

            Helper.logInfo('Saving conditional to database', {
                id: data.id,
                operator: data.operator,
                has_satisfied: Boolean(data.satisfied),
                has_unsatisfied: Boolean(data.unsatisfied),
            });

            await this.table().insert(data);
            Helper.logInfo('Successfully saved conditional', { id: data.id });
        } catch (error) {
            Helper.logError('Error saving WS REST conditional:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a WS REST conditional by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<WSRestConditional | null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();

            return result ? new WSRestConditional(result) : null;
        } catch (error) {
            Helper.logError('Error finding WS REST endpoint:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates an existing WS REST conditional in the database.
     * @param {WSRestConditional} conditional
     * @returns {Promise<void>}
     */
    async update(conditional) {
        try {
            const data = {
                satisfied: conditional.satisfied.value,
                unsatisfied: conditional.unsatisfied.value,
                operator: conditional.operator.value,
                input_path_a: conditional.input_path_a.value,
                input_path_b: conditional.input_path_b.value,
            };

            if (conditional.updated_at) {
                data.updated_at = conditional.updated_at.value;
            }
            if (conditional.updated_by) {
                data.updated_by = conditional.updated_by.value;
            }

            Helper.logInfo('Updating conditional in database', {
                id: conditional.id.value,
                data_to_update: data,
                operator: data.operator,
                satisfied_value: data.satisfied,
                unsatisfied_value: data.unsatisfied,
                has_satisfied: Boolean(data.satisfied),
                has_unsatisfied: Boolean(data.unsatisfied),
            });

            await this.table().where({ id: conditional.id.value }).update(data);

            Helper.logInfo('Successfully updated conditional', { id: conditional.id.value });
        } catch (error) {
            Helper.logError('Error updating WS REST conditional:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Saves history for a WS REST conditional.
     * @param {WSRestConditional} conditional
     * @param {Object} originalValues
     * @returns {Promise<void>}
     */
    async saveHistory(conditional, originalValues) {
        Helper.logInfo('Skipping history save for conditional', { id: conditional.id.value });
        return Promise.resolve();
    }

    /**
     * Searches for `WSRestEndpoint` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<WSRestConditional[]>} A promise that resolves to an array of `WSRestEndpoint` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.table().select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            return rows.map((row) => new WSRestConditional(row));
        } catch (error) {
            Helper.logError('Error searching WS REST endpoints:', error);
            throw new QueryDBError('search');
        }
    }
}
