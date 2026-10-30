import { AuxDefinitionResponse } from '../AuxDefinitionResponse.js';
import { ValueObjectUuid } from '../../../shared/index.js';

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
     * Busca una AuxDefinition por su ID y la retorna como respuesta estándar.
     * @param {ValueObjectUuid} id
     * @returns {Promise<AuxDefinitionResponse|null>}
     */
    async execute(id) {
        const auxDefinition = await this.#repository.find(new ValueObjectUuid('id', id));
        return new AuxDefinitionResponse(auxDefinition);
    }
}
