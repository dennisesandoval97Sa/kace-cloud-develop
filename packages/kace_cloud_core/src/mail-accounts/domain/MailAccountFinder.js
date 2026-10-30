import { ValueObjectUuid } from '../../shared/index.js';

export class MailAccountFinder {
    /** @type {KnexMailAccountRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id
     * @return {Promise<MailAccount>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
