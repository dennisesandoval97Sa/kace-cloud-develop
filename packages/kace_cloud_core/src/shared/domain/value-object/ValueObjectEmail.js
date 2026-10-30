import { ValueObject } from './ValueObject.js';
import { Guards } from '../guards/Guards.js';
import { RegexPatterns } from '../regex/RegexPatterns.js';

export class ValueObjectEmail extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringPattern(this, RegexPatterns.emailRegex(), `${this.field}: Invalid value for object email`);
        }
    }
}
