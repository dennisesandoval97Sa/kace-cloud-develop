import { Guards, RegexPatterns, ValueObjectString } from '../../shared';

export class ValueObjectTitle extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (nullable && !value) return;
        Guards.stringMaxLength(this, 100);
        Guards.stringMinLength(this, 1);
        Guards.stringPattern(this, RegexPatterns.onlyLetters());
    }
}
