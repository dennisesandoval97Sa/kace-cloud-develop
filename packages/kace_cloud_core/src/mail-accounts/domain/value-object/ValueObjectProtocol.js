import { Protocols } from '../../index';

export class ValueObjectProtocol {
    /** @type {Protocols} is initialized in the constructor */
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
        return Protocols.fromValue(value);
    }

    get value() {
        if (this.#value === null) {
            return null;
        }
        return this.#value.value;
    }
}
