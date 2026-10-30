import { ValueObjectString, Guards } from '../../shared';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns.js';

export class ValueObjectUserName extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringMaxLength(this, 100);
            Guards.stringMinLength(this, 1);
            Guards.stringPattern(
                this,
                RegexPatterns.extendedCharactersRegex(),
                `${this.field}: The name must contain only letters, numbers and some symbols: ${value}`
            );
        }
    }
}
