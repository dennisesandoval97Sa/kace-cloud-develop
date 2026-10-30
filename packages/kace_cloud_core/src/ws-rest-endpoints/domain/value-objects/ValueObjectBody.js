import { ValidationFailError } from '../../../shared/errors/ValidationFailError';
import { ValueObjectJson } from '../../../shared/domain/value-object/ValueObjectJson';

export class ValueObjectBody extends ValueObjectJson {
    static MINIMUM_NODES = 1;

    constructor(value) {
        super('body', value);
        this.#ensureValidBody(value);
    }

    /**
     * Ensures that the on_succes structure is valid by running all necessary validations.
     *
     * @param {Object} value - The value of the diagram to validate
     * @throws {ValidationFailError} If the diagram fails the validations
     */
    #ensureValidBody(value) {
        this.#ensureValidObject(value.body);
    }

    /**
     * Validates that value is a valid keys
     *
     * @param {*} obj - The object to validate
     */
    #ensureValidObject(obj) {
        if (obj === null || obj === undefined) {
            return;
        }
        if (typeof obj !== 'object' && typeof obj !== 'string') {
            throw new ValidationFailError(`The property must be an Object or a String`, this.field);
        }
    }
}
