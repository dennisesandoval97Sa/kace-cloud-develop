import { ValueObject } from './ValueObject.js';
import { Guards } from '../guards/Guards.js';
import { RegexPatterns } from '../regex/RegexPatterns.js';
import { InvalidArgumentError } from '../../errors/InvalidArgumentError.js';

export class ValueObjectColor extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new InvalidArgumentError(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringPattern(
                this,
                RegexPatterns.colorRegex(),
                `${this.field}: Invalid value ${value} for object color`
            );
        }
    }
}
