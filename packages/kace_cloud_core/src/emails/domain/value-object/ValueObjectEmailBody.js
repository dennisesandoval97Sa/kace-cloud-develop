import { ValueObject } from '../../../shared';

export class ValueObjectEmailBody extends ValueObject {
    constructor(field, value, nullable = false) {
        if (value == null) {
            if (!nullable) {
                throw new Error(`${field}: The email body cannot be null`);
            }
            super(field, null);
            return;
        }

        const finalValue = typeof value === 'string' ? value : String(value);

        super(field, finalValue);
    }
}
