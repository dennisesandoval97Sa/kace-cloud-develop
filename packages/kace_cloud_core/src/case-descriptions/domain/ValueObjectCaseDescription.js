import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../shared/domain/guards/Guards.js';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns.js';

export class ValueObjectCaseDescription extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);

        Guards.stringType(this);
        Guards.stringPattern(
            this,
            RegexPatterns.extendedHtmlRegex(),
            `${this.field}: The name must contain only letters, numbers and some symbols: ${value}`
        );
    }
}
