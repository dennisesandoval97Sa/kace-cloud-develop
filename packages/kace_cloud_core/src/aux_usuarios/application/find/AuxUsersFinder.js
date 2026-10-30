import { AuxUserResponse } from '../AuxUserResponse.js';
import { ValueObjectUuid } from '../../../shared/index.js';

export class AuxUsersFinder {
    /** @type {KnexAuxUsersRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexAuxUsersRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} userId record indentificator for search
     * @returns {Promise<AuxUserResponse>}
     */
    async execute(userId) {
        const id = new ValueObjectUuid('id', userId);
        const auxClient = await this.#repository.findByUser(id);
        return new AuxUserResponse(auxClient);
    }
}
