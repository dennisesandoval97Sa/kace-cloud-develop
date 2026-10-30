import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { WSRestFunction } from '../../domain/WSRestFunction.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class KnexWSRestFunctionRepository extends KnexRepository {
    constructor(config) {
        super(config, 'ws_rest_functions');
    }

    /**
     * Saves a WSRestFunction entity to the database.
     *
     * @param {WSRestFunction} restFunction - The WSRestFunction instance to be stored.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     * @throws {QueryDBError} If an error occurs while saving the entity.
     */
    async save(restFunction) {
        try {
            await this.table().insert({
                id: restFunction.id.value,
                description: restFunction.description.value,
                type: restFunction.type.value,
                filter_input: restFunction.filter_input.value,
                context_position: restFunction.context_position.value,
                value_static: restFunction.value_static.value,
                value_dynamic: restFunction.value_dynamic.value,
                is_active: restFunction.is_active.value,
                created_at: restFunction.created_at.value,
                created_by: restFunction.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving the restFunction', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Updates an existing WSRestFunction entity in the database.
     *
     * @param {WSRestFunction} restFunction - The WSRestFunction instance with updated data.
     * @returns {Promise<void>} A promise that resolves when the update is successful.
     * @throws {QueryDBError } If an error occurs while updating the entity.
     */
    async update(restFunction) {
        try {
            return this.table().where({ id: restFunction.id.value }).update(restFunction.changedAttributes);
        } catch (error) {
            Helper.logError('Error updating the restFunctions', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Retrieves a WSRestFunction entity by its unique identifier.
     *
     * @param {ValueObjectUuid} id - The UUID of the WSRestFunction to retrieve.
     * @returns {Promise<WSRestFunction|null>} A promise resolving to the found entity or null if not found.
     * @throws {QueryDBError} If an error occurs during the lookup.
     */
    async find(id) {
        try {
            const idValue = id?.value;
            const restFunction = await this.table().where({ id: idValue }).first();

            return restFunction ? new WSRestFunction(restFunction) : null;
        } catch (error) {
            Helper.logError('Error finding the restFunctions', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for WSRestFunction entities based on the specified criteria.
     *
     * @param {Criteria} criteria - The filtering conditions for the search.
     * @returns {Promise<WSRestFunction[]>} A promise resolving to an array of matching WSRestFunction instances.
     * @throws {QueryDBError} If an error occurs during the search.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.table().select('*');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_by');

            const restFunctions = await queryBuilder;
            return restFunctions.map((restFunction) => new WSRestFunction(restFunction));
        } catch (error) {
            Helper.logError('Error searching for restFunctions', error);
            throw new QueryDBError('search');
        }
    }
}
