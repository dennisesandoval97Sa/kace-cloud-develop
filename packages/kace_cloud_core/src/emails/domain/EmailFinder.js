import { ValueObjectUuid } from '@kace/core/src/shared';
import { Email } from './Email';
import { KnexEmailsRepository } from '../infrastructure/persistence/KnexEmailsRepository';

export class EmailFinder {
    /** @type {KnexEmailsRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Busca un Email por su ID.
     * @param {string} id
     * @returns {Promise<Email|null>}
     */
    async execute(id) {
        return await this.#repository.find(new ValueObjectUuid('id', id));
    }
}
