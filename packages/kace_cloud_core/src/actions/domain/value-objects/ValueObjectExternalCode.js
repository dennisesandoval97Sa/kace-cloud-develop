import { Guards, RegexPatterns, ValueObjectString } from '../../../shared/index.js';

export class ValueObjectExternalCode extends ValueObjectString {
    constructor(field, value, nullable = true) {
        super(field, value, nullable);
        if (!value && nullable) {
            return;
        }
        Guards.stringPattern(this, RegexPatterns.extendedCharactersRegex());
        Guards.stringMaxLength(this, 100);
    }
}
