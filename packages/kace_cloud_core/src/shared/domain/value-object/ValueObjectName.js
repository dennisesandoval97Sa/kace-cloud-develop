import { ValueObject } from './ValueObject';
import { Guards } from '../guards/Guards.js';
import { RegexPatterns } from '../regex/RegexPatterns.js';

export class ValueObjectName extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringMaxLength(this, 100);
            Guards.stringMinLength(this, 3);
            Guards.stringPattern(
                this,
                RegexPatterns.onlyLetters(),
                `${this.field}: The name must contain only letters: ${value}`
            );
        }
    }
}
