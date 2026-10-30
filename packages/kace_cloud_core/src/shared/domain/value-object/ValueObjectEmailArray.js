import { ValueObjectEmail } from './ValueObjectEmail.js';
import { ValueObject } from './ValueObject.js';
import { Guards } from '../guards/Guards.js';
import { InvalidArgumentError } from '../../errors/InvalidArgumentError.js';
import { Helper } from '../../index.js';

export class ValueObjectEmailArray extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!nullable && !value) {
            throw new InvalidArgumentError(`${this.field}: The value cannot be null`);
        }
        if (nullable && !value) {
            return;
        }

        Guards.arrayType(this);
        if (value && value.length === 0 && !nullable) {
            throw new Error(`${this.field}: The array cannot be empty`);
        }

        this.ensureEmails(value);
    }

    ensureEmails(value) {
        value.forEach((email) => {
            try {
                new ValueObjectEmail(this.field, email);
            } catch (error) {
                Helper.logError(error);
                throw new Error(`${this.field}: ${error.message}`);
            }
        });
    }
}
