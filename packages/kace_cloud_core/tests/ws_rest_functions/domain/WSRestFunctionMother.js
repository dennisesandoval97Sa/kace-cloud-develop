import { v4 as uuidv4 } from 'uuid';
import { WSRestFunction } from '../../../src/ws_rest_functions/domain/WSRestFunction.js';

export default class WSRestFunctionMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `WsRestFunction` entity.
     *
     * @returns {Object} The DTO containing the properties for a `WsRestFunction` entity.
     */

    static dto({
        id,
        description,
        is_active,
        created_at,
        created_by,
        type,
        filter_input,
        context_position,
        value_static,
        value_dynamic,
        updated_at = null,
        updated_by = null,
    } = {}) {
        return {
            id: id ?? uuidv4(),
            description: description ?? `Default function description ${uuidv4()}`,
            is_active: is_active ?? true,
            type: type ?? 'formatDate',
            filter_input: filter_input ?? { filter_input: ['hola'] },
            context_position: context_position ?? 'items[1].price',
            value_static: value_static ?? 'Test value_static',
            value_dynamic: value_dynamic ?? false,
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
            updated_at,
            updated_by,
        };
    }

    /**
     * Creates a `WsRestFunction` instance and saves it to the repository.
     *
     * @param {KnexWSRestFunctionRepository} repository - The repository to save the `WsRestFunction` instance.
     * @param data
     * @returns {Promise<WSRestFunction>} The created `WsRestFunction` instance.
     */
    static async create(repository, data = {}) {
        const wsRestFunction = WSRestFunction.create(WSRestFunctionMother.dto(data));
        await repository.save(wsRestFunction);
        return wsRestFunction;
    }

    static dtoTypeIncrementAndStaticValueStringNumber() {
        return {
            description: 'incrementar',
            type: 'increment',
            is_active: true,
            value_dynamic: true,
            value_static: '10',
            context_position: 'results.pokemon1',
            filter_input: {
                filter_input: ['pokemon1.game_index'],
            },
            id: uuidv4(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static dtoTypeIncrementAndStaticValueNumberInteger() {
        return {
            description: 'incrementar',
            type: 'increment',
            is_active: true,
            value_dynamic: true,
            value_static: 10,
            context_position: 'results.pokemon1',
            filter_input: {
                filter_input: ['pokemon1.game_index'],
            },
            id: uuidv4(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static dtoTypeIncrementAndStaticValueString() {
        return {
            description: 'incrementar',
            type: 'increment',
            is_active: true,
            value_dynamic: true,
            value_static: 'hola',
            context_position: 'results.pokemon1',
            filter_input: {
                filter_input: ['pokemon1.game_index'],
            },
            id: uuidv4(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }
}
