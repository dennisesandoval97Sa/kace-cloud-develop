import { CustomError } from '../../../shared/errors/CustomError.js';
import { DomainMailAccountFinder } from '../../index.js';

export class MailAccountDeleter {
    /** @type {DomainMailAccountFinder} is initialized in the constructor*/
    #finder;
    /** @type {KnexMailAccountRepository} is initialized in the constructor*/
    #repository;

    /**
     * Creates an instance of the `MailAccountDeleter` class.
     *
     * @param {KnexMailAccountRepository} repository - An instance of the repository that manages mail account records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainMailAccountFinder(repository);
    }

    /**
     * Deletes a `MailAccount` object from the repository.
     *
     * This method finds the mail account by its ID, applies deletion operations, updates the repository with the modified mail account object, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the mail account object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `MailAccount` object.
     * @returns {Promise<void>} A promise that resolves when the `MailAccount` object is deleted.
     * @throws {CustomError} Throws an error if the MailAccount object does not exist.
     */
    async execute(id, dto) {
        const mailAccount = await this.#finder.execute(id);

        if (!mailAccount) {
            throw new CustomError('The mail account you are trying delete does not exist', 404);
        }

        mailAccount.delete(dto);

        await this.#repository.delete(mailAccount);

        mailAccount.flushChanges();
    }
}
