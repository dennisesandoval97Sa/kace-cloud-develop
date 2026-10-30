import { ValueObjectJson } from '../../../shared/domain/value-object/ValueObjectJson';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';

export class ValueObjectSuccess extends ValueObjectJson {
    constructor(value) {
        super('on_success', value);
        this.#ensureValidOnSuccess(value);
    }

    /**
     * Ensures that the on_succes structure is valid by running all necessary validations.
     *
     * @param {Object} value - The value of the diagram to validate
     * @throws {InvalidArgumentError} If the diagram fails the validations
     */
    #ensureValidOnSuccess(value) {
        this.#ensureValidObject(value.on_success);
    }

    /**
     * Validates that value is a valid keys
     *
     * @param {*} obj - The object to validate
     */
    #ensureValidObject(obj) {
        if (!(typeof obj === 'object')) {
            throw new InvalidArgumentError(`${this.field}: The property must be an Object`);
        }
    }
}
