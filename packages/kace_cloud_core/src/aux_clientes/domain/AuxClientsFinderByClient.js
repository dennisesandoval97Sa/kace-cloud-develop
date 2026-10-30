import { ValueObjectUuid } from '../../shared';

export class AuxClientsFinderByClient {
    /** @type {KnexAuxClientsRepository} is initialized in the constructor  */
    #repository;

    /**
     *
     * @param {KnexAuxClientsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} clientId identificator record to find
     * @returns {Promise<AuxClients}
     */
    async execute(clientId) {
        return this.#repository.findByClient(new ValueObjectUuid('Cliente id', clientId));
    }
}
