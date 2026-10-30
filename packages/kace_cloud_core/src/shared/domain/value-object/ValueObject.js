export class ValueObject {
    /** is initialized in the constructor */
    #value;

    constructor(field, value) {
        this.#value = value;
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        return this.#value;
    }
}
