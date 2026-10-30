import { PositionTypes } from '../../index';

export class ValueObjectPositions {
    /**
     * @type {Types}
     * is initialized in the constructor
     */
    #value;

    constructor(field, value) {
        this.#value = PositionTypes.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        return this.#value.value;
    }
}
