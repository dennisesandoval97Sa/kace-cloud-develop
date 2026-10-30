import { KnexRepository, ValidationFailError } from '../index.js';

export class RestFlowExistenceValidator {
    /** @type {KnexRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Valida que el restflow_id exista en la tabla ws_rest_flows.
     * @param {ValueObjectUuid} restFlowId
     * @returns {Promise<void>} Lanza error si no existe
     */
    async execute(restFlowId) {
        const exists = await this.#repository.restFlowExistenceValidator(restFlowId);
        if (!exists) {
            throw new ValidationFailError(`The ${restFlowId.value} does not exist in Rest Flows`, 'id');
        }
    }
}
