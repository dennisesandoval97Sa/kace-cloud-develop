import { Guards } from '../../shared/domain/guards/Guards';
import { ValueObjectString } from '../../shared';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns.js';
export class ValueObjectDescripcion extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        Guards.stringMaxLength(this, 30000);
        Guards.stringMinLength(this, 10);
        Guards.stringPattern(
            this,
            RegexPatterns.extendedHtmlRegex(),
            `${this.field}: The name must contain only letters: ${value}`
        );
    }
}
