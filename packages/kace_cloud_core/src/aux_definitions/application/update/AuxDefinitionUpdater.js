import { CustomError } from '../../../shared/errors/CustomError.js';
import { AuxDefinitionFinder } from '../../domain/AuxDefinitionFinder.js';

export class AuxDefinitionUpdater {
    /** @type {AuxDefinitionFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexAuxDefinitionsRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexAuxDefinitionsRepository} repository
     */
    constructor(repository) {
        this.#finder = new AuxDefinitionFinder(repository);
        this.#repository = repository;
    }

    /**
     * Actualiza un AuxDefinition existente.
     * @param {object} dto - Datos para actualizar
     * @param {string} id - Identificador del registro a actualizar
     * @returns {Promise<void>}
     */
    async execute(dto, id) {
        const auxDefinition = await this.#finder.execute(id);
        if (!auxDefinition) {
            throw new CustomError('AuxDefinition que intenta actualizar no existe', 404);
        }
        const originalValues = auxDefinition.toJson();
        auxDefinition.update(dto);
        await this.#repository.update(auxDefinition);
        await this.#repository.saveHistory(auxDefinition, originalValues);
        auxDefinition.flushChanges();
    }
}
