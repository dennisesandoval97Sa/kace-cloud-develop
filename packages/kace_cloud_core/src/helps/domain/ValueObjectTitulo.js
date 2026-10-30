import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString';
import { Guards } from '../../shared/domain/guards/Guards';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns';

export class ValueObjectTitulo extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        Guards.stringMaxLength(this, 50);
        Guards.stringMinLength(this, 5);
        Guards.stringPattern(this, RegexPatterns.onlyLetters(), `${this.field} only must contain letters and spacing`);
    }
}
