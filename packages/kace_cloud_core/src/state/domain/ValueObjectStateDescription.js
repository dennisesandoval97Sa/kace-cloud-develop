import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns';
import { Guards } from '../../shared/domain/guards/Guards';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString';

export class ValueObjectStateDescription extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        Guards.stringMaxLength(this, 1000);
        Guards.stringMinLength(this, 1);
        Guards.stringPattern(
            this,
            RegexPatterns.descriptionRegex(),
            `${this.field}: The name must contain only letters: ${value}`
        );
    }
}
