import { Guards, RegexPatterns, ValueObjectString } from '../../../shared';

export class ValueObjectHost extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);

        if (nullable) return;

        Guards.stringMaxLength(this, 255);
        Guards.stringPattern(this, RegexPatterns.hostRegex(), `${this.field} is not an allowed host`);
    }
}
