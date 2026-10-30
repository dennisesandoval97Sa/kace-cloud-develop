import { v4 as uuidv4 } from 'uuid';
import { WSRestConditional } from '../../../src/ws-rest-conditionals/domain/WSRestConditional.js';

export default class WSRestConditionalMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `WSRestConditional` entity.
     *
     * @returns {Object} The DTO containing the properties for a `WSRestConditional` entity.
     */
    static dto({
        id,
        satisfied,
        unsatisfied,
        operator,
        input_path_a,
        input_path_b,
        created_at,
        created_by,
    } = {}) {
        return {
            id: id ?? uuidv4(),
            satisfied: satisfied ?? uuidv4(),
            unsatisfied: unsatisfied ?? uuidv4(),
            operator: operator ?? 'eq',
            input_path_a: input_path_a ?? 'context.value',
            input_path_b: input_path_b ?? 'expected',
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
        };
    }

    /**
     * Creates a `WSRestConditional` instance and saves it to the repository.
     *
     * @param {KnexWSRestConditionalRepository} repository - The repository to save the `WSRestConditional` instance.
     * @param data
     * @returns {Promise<WSRestConditional>} The created `WSRestConditional` instance.
     */
    static async create(repository, data = {}) {
        const conditional = WSRestConditional.create(WSRestConditionalMother.dto(data));
        await repository.save(conditional);
        return conditional;
    }
}
