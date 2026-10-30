import { Formulas } from '../Formulas.js';

export class ValueObjectFormula {
    /** @type {Formulas} is initialized in the constructor*/
    #value;

    constructor(field, value, nullable = false) {
        if (!value && !nullable) {
            throw new Error(`${field}: The value cannot be null`);
        }

        if (!value && nullable) {
            this.#value = null;
            return;
        }

        this.#value = Formulas.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        if (!this.#value) {
            return null;
        }

        return this.#value.value;
    }
}
