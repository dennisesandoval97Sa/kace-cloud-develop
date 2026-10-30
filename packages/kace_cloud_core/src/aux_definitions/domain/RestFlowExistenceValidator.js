import { ValidationFailError } from '../../shared/index.js';

export class RestFlowExistenceValidator {
    /** @type {KnexWSRestFlowRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexWSRestFlowRepository} repository
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
        const exists = await this.#repository.find(restFlowId);
        if (!exists) {
            throw new ValidationFailError(`The ${restFlowId.value} does not exist in Rest Flows`, 'id');
        }
    }
}
