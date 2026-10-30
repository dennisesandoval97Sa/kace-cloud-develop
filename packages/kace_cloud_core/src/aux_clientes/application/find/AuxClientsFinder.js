import { AuxClientResponse } from '../AuxClientResponse';
import { DomainAuxClientsFinderByClient } from '../../index.js';

export class AuxClientsFinder {
    /** @type {DomainAuxClientsFinderByClient} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexAuxClientsRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainAuxClientsFinderByClient(repository);
    }

    /**
     *
     * @param {string} clientId record indentificator for search
     * @returns {Promise<AuxClientResponse>}
     */
    async execute(clientId) {
        const auxClient = await this.#finder.execute(clientId);
        return new AuxClientResponse(auxClient);
    }
}
