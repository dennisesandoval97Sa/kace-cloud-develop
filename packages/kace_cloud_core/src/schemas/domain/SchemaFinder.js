import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid.js';

export class SchemaFinder {
    /** @type {KnexSchemasRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexSchemasRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Busca un Schema por su ID.
     * @param {string} id
     * @returns {Promise<Schema|null>}
     */
    async execute(id) {
        return await this.#repository.find(new ValueObjectUuid('id', id));
    }
    async executeIfActive(id) {
        return await this.#repository.findByIdAndActive(new ValueObjectUuid('id', id));
    }
}
