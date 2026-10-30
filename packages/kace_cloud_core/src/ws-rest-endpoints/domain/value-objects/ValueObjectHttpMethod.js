import { HttpMethods } from '../HttpMethods.js';

export class ValueObjectHttpMethod {
    /** @type {HttpMethods} is initialized in the constructor */
    #value;

    constructor(field, value, nullable = false) {
        if (!value && !nullable) {
            throw new Error(`${field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        this.#value = HttpMethods.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        return this.#value ? this.#value.value : null;
    }
}
