import { Encryptions } from '../../index';

export class ValueObjectEncryption {
    /** @type {Encryptions} is initialized in the constructor */
    #value;

    constructor(field, value, nullable = false) {
        this.field = field;
        this.#value = this.initializeValue(value, nullable);
        Object.freeze(this);
    }

    initializeValue(value, nullable) {
        if (nullable && (value === undefined || value === null)) {
            return null;
        }
        return Encryptions.fromValue(value);
    }

    get value() {
        if (this.#value === null) {
            return null;
        }
        return this.#value.value;
    }
}
