import { ValueObjectString } from './ValueObjectString';
import { Guards } from '../guards/Guards.js';
import { RegexPatterns } from '../regex/RegexPatterns.js';

export class ValueObjectDescription extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringMaxLength(this, 255);
            Guards.stringMinLength(this, 3);
            Guards.stringPattern(
                this,
                RegexPatterns.extendedCharactersRegex(),
                `${this.field}: The name must contain only letters, numbers and some symbols: ${value}`
            );
        }
    }
}
