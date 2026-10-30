import { VOTableName } from './VOTableName.js';
import { ValidationFailError } from '../../shared/index.js';

export class AuxDefinitionTableNameFinder {
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
     * @param {string} tableName
     * @returns {Promise<AuxDefinition|null>}
     */
    async execute(tableName) {
        const auxDefinition = await this.#repository.findByTableName(new VOTableName(tableName));
        if (!auxDefinition) {
            throw new ValidationFailError(`The ${tableName} does not exist in aux_definitions`, 'entity');
        }
        return auxDefinition;
    }
}
