import { CustomError } from '../../../shared/index.js';
import { DomainMailAccountFinder, MailAccountResponse } from '../../index.js';

export class MailAccountFinder {
    /** @type {DomainMailAccountFinder} is initialized in the constructor*/
    #finder;
    constructor(repository) {
        this.#finder = new DomainMailAccountFinder(repository);
    }
    /**
     * Executes the finding of an MailAccount object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the MailAccount object to find.
     * @returns {Promise<MailAccountResponse>} A promise that resolves to an MailAccountResponse object containing the found MailAccount data.
     */
    async execute(id) {
        const mailAccount = await this.#finder.execute(id);

        if (!mailAccount || mailAccount.isDeleted()) {
            throw new CustomError('mail acccount not found', 404);
        }

        return new MailAccountResponse(mailAccount);
    }
}
