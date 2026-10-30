import { Guards } from '../../shared/domain/guards/Guards';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString';

export class ValueObjectDescription extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        if (nullable) return;
        Guards.stringMaxLength(this, 200);
        Guards.stringPattern(this, RegexPatterns.descriptionRegex(), `${this.field} contains not allowed characters`);
    }
}
