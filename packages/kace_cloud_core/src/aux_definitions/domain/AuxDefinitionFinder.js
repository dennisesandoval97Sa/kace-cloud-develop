import { ValueObjectUuid } from '../../shared/index.js';

export class AuxDefinitionFinder {
    /** @type {KnexAuxDefinitionsRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexAuxDefinitionsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Busca una AuxDefinition por su ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<AuxDefinition|null>}
     */
    async execute(id) {
        return await this.#repository.find(new ValueObjectUuid('id', id));
    }
}
