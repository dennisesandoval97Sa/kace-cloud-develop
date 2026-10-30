import { ValueObjectJson } from '../../../shared/domain/value-object/ValueObjectJson';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';

export class ValueObjectError extends ValueObjectJson {
    constructor(value) {
        super('on_error', value);
        this.#ensureValidOnError(value);
    }

    /**
     * Ensures that the on_error structure is valid by running all necessary validations.
     *
     * @param {Object} value - The value of the diagram to validate
     * @throws {InvalidArgumentError} If the diagram fails the validations
     */
    #ensureValidOnError(value) {
        this.#ensureValidObject(value.on_error);
    }

    /**
     * Validates that value is a valid Object
     *
     * @param {*} obj - The object to validate
     */
    #ensureValidObject(obj) {
        if (!(typeof obj === 'object')) {
            throw new InvalidArgumentError(`${this.field}: The property must be an Object`);
        }
    }
}
