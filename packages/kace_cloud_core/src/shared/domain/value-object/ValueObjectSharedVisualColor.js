import { InvalidArgumentError } from '../../errors/InvalidArgumentError.js';
import { ValueObjectColor } from './ValueObjectColor.js';
import { isSharedVisualColorAllowed } from '../../visual-options/sharedVisualOptions.js';

export class ValueObjectSharedVisualColor extends ValueObjectColor {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && nullable) {
            return;
        }

        if (!isSharedVisualColorAllowed(value)) {
            throw new InvalidArgumentError(`${field}: Unsupported visual color ${value}`);
        }
    }
}
