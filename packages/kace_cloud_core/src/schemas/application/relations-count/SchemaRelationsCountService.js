import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { SchemaFinder } from '../../domain/SchemaFinder.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';

export class SchemaRelationsCountService {
    /** @type {SchemaFinder} is initialized in the constructor */
    #finder;
    /**
     * @param {KnexSchemasRepository} repository
     */
    constructor(repository) {
        this.repository = repository;
        this.#finder = new SchemaFinder(repository);
    }

    /**
     * Devuelve un objeto con el número de definiciones relacionadas a un schema por su id.
     * @param {string} id
     * @returns {Promise<{data: {related_count: number}}>}
     */
    async execute(id) {
        const schema = await this.#finder.execute(id);
        if (!schema) {
            throw new ValidationFailError('The schema does not exist');
        }
        const count = await this.repository.countRelationsBySchemaId(new ValueObjectUuid('id', id));
        return { data: { related_count: count } };
    }
}
