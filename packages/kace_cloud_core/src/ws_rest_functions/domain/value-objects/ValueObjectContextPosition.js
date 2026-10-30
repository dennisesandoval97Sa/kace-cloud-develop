import { ValueObjectString } from '../../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../../shared/domain/guards/Guards.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';

export class ValueObjectContextPosition extends ValueObjectString {
    #PATH_REGEX = /^([\w$]+(\[\d+\])?)(\.[\w$]+(\[\d+\])?)*$/;
    /**
     * @param {object} value
     * @param {nullable} nullable
     */
    constructor(value) {
        if (!value) {
            throw new ValidationFailError('The value cannot be null', 'context_position');
        }

        super('context_position', value);

        if (value) {
            Guards.stringType(this);
            Guards.stringMinLength(this, 3);
            Guards.stringMaxLength(this, 1024);
            this.#validPath();
        }
    }
    /**
     * Validates if the current value matches the expected file path format.
     *
     * @private
     * @throws {Error} If the value does not conform to the required path format.
     *
     */
    #validPath() {
        if (!this.#PATH_REGEX.test(this.value)) {
            throw new ValidationFailError('Invalid format', this.field);
        }
    }
}
