import { ValueObjectEmail } from '../../shared/index.js';
import { KnexMailAccountRepository } from '../infrastructure/persistence/KnexMailAccountRepository.js';

export class MailAccountFinderMail {
    /** @type {KnexMailAccountRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} emailAccount
     * @return {Promise<MailAccount>}
     */
    async execute(emailAccount) {
        return this.#repository.findIdByEmailAccount(new ValueObjectEmail('email_account', emailAccount));
    }
}
