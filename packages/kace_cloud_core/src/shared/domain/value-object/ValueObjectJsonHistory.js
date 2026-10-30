import { Guards } from '../guards/Guards.js';

export default class ValueObjectJsonHistory {
    /** @type {JSON} is initialized in the constructor */
    #value;

    constructor(field, value, nullable = false) {
        this.#value = value;
        this.field = field;
        if (!value && !nullable) {
            throw new Error(`${field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            this.#value = typeof value === 'string' ? JSON.parse(value) : value;
            Guards.objectType(this);
            this.parseValueDataIfExists();
        }
    }

    get value() {
        return this.#value;
    }

    parseValueDataIfExists() {
        if (this.#value && this.#value?.data) {
            const data = this.#value.data;
            if (typeof data === 'string') {
                const valueParsed = JSON.parse(data);
                this.#value = {
                    ...this.#value,
                    data: valueParsed,
                };
            }
        }
    }
}
