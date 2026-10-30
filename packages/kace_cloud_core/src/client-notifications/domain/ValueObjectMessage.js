import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../shared/domain/guards/Guards.js';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns.js';

export class ValueObjectMessage extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (this.value === null) return;

        Guards.stringMaxLength(this, 1000);
        Guards.stringPattern(
            this,
            RegexPatterns.descriptionRegex(),
            `${this.field}: The name must contain only letters: ${value}`
        );
    }
}
