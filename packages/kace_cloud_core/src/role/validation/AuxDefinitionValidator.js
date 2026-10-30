import { ValidationFailError } from '../../shared/errors/ValidationFailError.js';

export class AuxDefinitionValidator {
    /** @type {KnexAuxDefinitionRepository} */
    #repository;

    /**
     * @param {KnexAuxDefinitionRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Validates that at least one name of each module exists in aux_definitions..
     *
     * @param {Array<{ module_id: string, name: string }>} auxiliaries
     * @returns {Promise<void>}
     * @throws {ValidationFailError}
     */
    async validate(auxiliaries = []) {
        const moduleIds = [...new Set(auxiliaries.map((aux) => aux.module_id))];

        for (const moduleId of moduleIds) {
            const definition = await this.#repository.existsByTableName(moduleId);
            if (!definition) {
                throw new ValidationFailError(
                    `The module "${moduleId}" has no registered permissions in aux_definitions.`,
                    'permisos'
                );
            }
        }
    }
}
