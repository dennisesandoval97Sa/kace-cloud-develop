import { MailAccountsTypes } from '../../shared';

export class MailAccountTypesResponse {
    constructor() {
        this.types = MailAccountsTypes.toJson();
    }

    /**
     * Converts the MailAccountTypes object to a JSON representation.
     *
     * @returns {Object} A plain object containing the MailAccountTypes data.
     */
    toJson() {
        return {
            data: this.types,
        };
    }
}
