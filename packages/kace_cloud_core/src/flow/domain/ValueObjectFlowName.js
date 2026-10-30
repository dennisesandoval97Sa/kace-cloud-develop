import { Guards, RegexPatterns, ValueObjectString } from '../../shared';

export class ValueObjectFlowName extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        Guards.stringType(this);
        Guards.stringMaxLength(this, 100);
        Guards.stringMinLength(this, 1);
        Guards.stringPattern(
            this,
            RegexPatterns.onlyLetters(),
            `${this.field}: The name must contain only letters: ${value}`
        );
    }
}
