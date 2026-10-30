import { ActionUpdateModel } from '..';
import { KnexRepository } from '../../shared/index';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';

export class KnexActionUpdateModelRepository extends KnexRepository {
    constructor(config) {
        super(config, 'action_model_updates');
    }

    /**
     * Saves a new model update record in the database.
     * @param {ActionUpdateModel} updateModel
     * @returns {Promise<void>}
     */
    async save(updateModel) {
        try {
            await this.table().insert({
                id: updateModel.id.value,
                description: updateModel.description.value,
                aggregate: updateModel.aggregate.value,
                field: updateModel.field.value,
                type: updateModel.type.value,
                value: updateModel.value.value,
                formula: updateModel.formula.value,
                created_at: updateModel.created_at.value,
                created_by: updateModel.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving model update:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a model update record by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<ActionUpdateModel | null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();

            return result ? new ActionUpdateModel(result) : null;
        } catch (error) {
            Helper.logError('Error finding model update:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for ActionUpdateModel instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<ActionUpdateModel[]>} A promise that resolves to an array of ActionUpdateModel instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.table().select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new ActionUpdateModel(row));
        } catch (error) {
            Helper.logError('Error searching model updates:', error);
            throw new QueryDBError('search');
        }
    }
}
