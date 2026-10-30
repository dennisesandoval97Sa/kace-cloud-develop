import { EmailBody } from '../domain/EmailBody';
import { buildEmailBodyPayload } from './EmailBodyResponsePayload.js';

export class EmailBodyResponse {
    /** @type {EmailBody} is initialized in the constructor */
    #emailBody;

    constructor(emailBody) {
        this.#emailBody = emailBody;
    }

    /**
     * Converts the Email object to  JSON representation.
     * @returns {Object} A plain object containing the Email data.
     */
    toJson() {
        if (!this.#emailBody) return {};

        return {
            data: buildEmailBodyPayload(this.#emailBody),
        };
    }
}
