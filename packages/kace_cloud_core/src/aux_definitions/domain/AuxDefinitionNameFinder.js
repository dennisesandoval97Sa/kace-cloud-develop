import { ValueObjectNameDefinition } from '../../shared/index.js';

export class AuxDefinitionNameFinder {
    /** @type {KnexAuxDefinitionsRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexAuxDefinitionsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * search for an AuxDefinition by name.
     * @param {ValueObjectNameDefinition} name
     * @returns {Promise<AuxDefinition|null>}
     */
    async byName(name) {
        return this.#repository.findByName(new ValueObjectNameDefinition('name', name));
    }
}
