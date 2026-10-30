import { Guards, ValidationFailError, ValueObjectString } from '../../../shared/index.js';

export class ValueObjectClientName extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && !nullable) {
            throw new ValidationFailError(`${this.field}: The value cannot be null`, this.field);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringMaxLength(this, 300);
            Guards.stringMinLength(this, 3);
            Guards.stringPattern(
                this,
                /^[a-zA-ZÀ-ž0-9\s#&()%.\-_@‘/:;,~“‰]*$/,
                `${this.field}: The name must contain only letters, numbers, and the following symbols: ( ) & % , . - / ; : @ # _ ~ ‘ “ ‰`
            );
        }
    }
}
