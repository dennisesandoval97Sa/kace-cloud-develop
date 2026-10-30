import { Guards } from '../../shared/domain/guards/Guards';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString';

export class ValueObjectGroupName extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        Guards.stringMaxLength(this, 100);
        Guards.stringMinLength(this, 3);
        Guards.stringPattern(this, RegexPatterns.onlyLetters(), `${this.field} only must contain letters and spacing`);
    }
}
