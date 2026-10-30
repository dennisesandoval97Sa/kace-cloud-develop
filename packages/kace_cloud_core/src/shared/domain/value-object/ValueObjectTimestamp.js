import { Helper } from '../../infrastructure/utils/Helper';

export class ValueObjectTimestamp {
    /** @type {Date} is initialized in the constructor*/
    #value;

    constructor(field, value, nullable = false) {
        this.field = field;
        if (!value && !nullable) {
            Helper.logError(`${this.field}: The value cannot be null`);
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            this.#value = value;
            return;
        } else {
            value = new Date(value);
            this.#ensureIsTimestamp(value);
        }
        this.#value = value;
    }

    get value() {
        if (!this.#value) {
            return null;
        }
        return this.#value.toISOString();
    }

    #ensureIsTimestamp(value) {
        if (value.toString() === 'Invalid Date') {
            Helper.logError(`${this.field}: Invalid value ${value} for object timestamp`);
            throw new Error(`${this.field}: Invalid value ${value} for object timestamp`);
        }
    }
}
