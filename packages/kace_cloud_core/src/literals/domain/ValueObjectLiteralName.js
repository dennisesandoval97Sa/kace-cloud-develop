import { Guards } from '../../shared/domain/guards/Guards.js';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { RegexPatterns } from '../../shared/domain/regex/RegexPatterns.js';

export class ValueObjectLiteralName extends ValueObjectString {
    /**
     * @param {string} value - The actual value of the name.
     * @param {boolean} nullable - Indicates if the value can be null.
     */
    constructor(value, nullable = false) {
        super('literal_name', value, nullable);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }
        Guards.stringMaxLength(this, 255);
        Guards.stringPattern(
            this,
            RegexPatterns.extendedCharactersRegex(),
            `${this.field}: The name must contain only letters, numbers and some symbols: ${value}`
        );
    }
}
