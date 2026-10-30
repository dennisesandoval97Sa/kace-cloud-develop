import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString';
import { Guards } from '../../shared/domain/guards/Guards';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns.js';

export class ValueObjectName extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        Guards.stringMaxLength(this, 255);
        Guards.stringMinLength(this, 10);
        Guards.stringPattern(
            this,
            RegexPatterns.extendedCharactersRegex(),
            `${this.field}: The name must contain only letters, numbers and some symbols: ${value}`
        );
    }
}
