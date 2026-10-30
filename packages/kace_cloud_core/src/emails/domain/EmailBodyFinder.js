import { ValueObjectUuid } from '@kace/core/src/shared';
import { KnexEmailsBodyRepository } from '../infrastructure/persistence/KnexEmailsBodyRepository';
import { EmailBody } from './EmailBody';

export class EmailBodyFinder {
    /** @type {KnexEmailsBodyRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexEmailsBodyRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Busca un board por su ID.
     * @param {string} id
     * @returns {Promise<EmailBody|null>}
     */
    async execute(id) {
        return await this.#repository.find(new ValueObjectUuid('id', id));
    }
}
