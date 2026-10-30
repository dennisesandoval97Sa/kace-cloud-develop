import { ValueObjectString } from '../value-object/ValueObjectString.js';
import { Guards } from '../guards/Guards.js';
import { RegexPatterns } from '../regex/RegexPatterns.js';

export default class VOName extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        Guards.stringPattern(
            this,
            RegexPatterns.extendedCharactersRegex(),
            `${this.field}: The name must contain only letters, numbers and some symbols: ${value}`
        );
    }
}
