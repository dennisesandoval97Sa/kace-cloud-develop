import { MailAccountResponse } from './MailAccountResponse.js';

export class MailAccountsCollectionResponse {
    /** @type {MailAccounts[]} is initialized in the constructor */
    #mailAccountsCollection;

    /** @type {number} is initialized in the constructor */
    #count;

    constructor(mailAccountsCollection, count) {
        this.#mailAccountsCollection = mailAccountsCollection;
        this.#count = count;
    }
    /**
     * Converts the MailAccounts object to a JSON representation.
     *
     * @returns {Object} A plain object containing the MailAccounts data.
     */
    toJson() {
        return {
            data: {
                items: this.#mailAccountsCollection.map(
                    (mailAccounts) => new MailAccountResponse(mailAccounts).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
