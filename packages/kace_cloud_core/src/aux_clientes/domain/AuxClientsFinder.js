import { ValueObjectUuid } from '../../shared';

export class AuxClientsFinder {
    /** @type {KnexAuxClientsRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexAuxClientsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {string} id identificador del registro a encontrar
     * @returns {Promise<AuxClients>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
