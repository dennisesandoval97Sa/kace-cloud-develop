import { Types } from '../Types.js';

export class ValueObjectTypes {
    /** @type {Types} is initialized in the constructor */
    #value;

    constructor(field, value) {
        this.#value = Types.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        return this.#value.value;
    }
}
