import { HttpRequestTypes } from '../HttpRequestTypes.js';

export class ValueObjectHttpRequestType {
    /** @type {HttpRequestTypes} is initialized in the constructor */
    #value;

    constructor(field, value, nullable = false) {
        if (!value && !nullable) {
            throw new Error(`${field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        this.#value = HttpRequestTypes.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        return this.#value ? this.#value.value : null;
    }
}
