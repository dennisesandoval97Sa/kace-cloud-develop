import { Guards } from '../../shared/domain/guards/Guards';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString';

export class ValueObjectDescription extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        if (nullable) return;
        Guards.stringMaxLength(this, 255);
        Guards.stringMinLength(this, 3);
        Guards.stringPattern(this, RegexPatterns.descriptionRegex(), 'Invalid description format');
    }
}
