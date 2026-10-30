import { ValidationFailError } from '../../shared/errors/ValidationFailError.js';
import { Guards } from '../../shared/domain/guards/Guards.js';
import { ValueObject } from '../../shared/domain/value-object/ValueObject.js';

const RESERVED_NAMES = ['cases', 'clients', 'definitions'];

export class ValueObjectNameDefinition extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if ((value === null || value === undefined) && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        }

        Guards.stringType(this);
        Guards.stringMaxLength(this, 45);
        Guards.stringMinLength(this, 3);

        const pattern = /^[a-z][a-z0-9_]*$/;
        if (!pattern.test(value)) {
            throw new ValidationFailError(`${this.field}: Must be in snake_case and lowercase only`, this.field);
        }

        if (RESERVED_NAMES.includes(value)) {
            throw new ValidationFailError(`${this.field}: '${value}' is a reserved name`, this.field);
        }
    }
}
