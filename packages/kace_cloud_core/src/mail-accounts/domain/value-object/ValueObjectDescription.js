import { Guards, RegexPatterns, ValueObjectString } from '../../../shared';

export class ValueObjectDescription extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);

        Guards.stringMaxLength(this, 120);
        Guards.stringMinLength(this, 3);
        Guards.stringPattern(this, RegexPatterns.descriptionRegex(), `${this.field} contains not allowed characters`);
    }
}
