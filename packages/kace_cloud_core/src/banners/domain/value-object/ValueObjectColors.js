import { ColorTypes } from '../../index';

export class ValueObjectColors {
    /**
     * @type {Types}
     * is initialized in the constructor
     */
    #value;

    constructor(field, value) {
        this.#value = ColorTypes.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        return this.#value.value;
    }
}
