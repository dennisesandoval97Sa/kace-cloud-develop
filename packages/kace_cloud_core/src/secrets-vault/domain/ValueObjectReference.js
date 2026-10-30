import { ValueObjectString } from '../../shared';
import { Guards } from '../../shared/domain/guards/Guards';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns';

export class ValueObjectReference extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        Guards.stringMaxLength(this, 255);
        Guards.stringMinLength(this, 3);
        Guards.stringPattern(this, RegexPatterns.referenceSecretRegex(), 'Invalid reference format');
    }
}
