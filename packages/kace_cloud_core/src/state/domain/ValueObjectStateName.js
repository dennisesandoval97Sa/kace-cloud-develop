import { RegexPatterns } from '../../shared';
import { Guards } from '../../shared/domain/guards/Guards';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString';

export class ValueObjectStateName extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        Guards.stringMaxLength(this, 50);
        Guards.stringMinLength(this, 3);
        Guards.stringPattern(
            this,
            RegexPatterns.onlyLetters(),
            `${this.field}: The name must contain only letters: ${value}`
        );
    }
}
