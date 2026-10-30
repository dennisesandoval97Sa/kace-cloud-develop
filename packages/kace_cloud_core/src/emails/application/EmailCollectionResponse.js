import { Email } from '../domain/Email';
import { EmailResponse } from './EmailResponse';

export class EmailCollectionResponse {
    /** @type {Email[]} is initialized in the constructor */
    #emailCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(emailCollection, count) {
        this.#emailCollection = emailCollection;
        this.#count = count;
    }

    /**
     * Converts the Email object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Email data.
     */
    toJson() {
        return {
            data: {
                items: this.#emailCollection.map((email) => new EmailResponse(email).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
