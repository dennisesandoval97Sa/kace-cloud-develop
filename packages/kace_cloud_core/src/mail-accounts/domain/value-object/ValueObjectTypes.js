import { MailAccountsTypes } from '../../../shared';

export class ValueObjectTypes {
    /** @type {Types} is initialized in the constructor */
    #value;

    constructor(field, value) {
        this.#value = MailAccountsTypes.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        if (this.#value === null) {
            return null;
        }

        return this.#value.value;
    }
}
