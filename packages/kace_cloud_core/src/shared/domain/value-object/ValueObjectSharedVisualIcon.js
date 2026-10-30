import { InvalidArgumentError } from '../../errors/InvalidArgumentError.js';
import { Guards } from '../guards/Guards.js';
import { ValueObjectString } from './ValueObjectString.js';
import { isSharedVisualIconAllowed } from '../../visual-options/sharedVisualOptions.js';

export class ValueObjectSharedVisualIcon extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && nullable) {
            return;
        }

        Guards.stringType(this);

        if (!isSharedVisualIconAllowed(value)) {
            throw new InvalidArgumentError(`${field}: Unsupported visual icon ${value}`);
        }
    }
}
