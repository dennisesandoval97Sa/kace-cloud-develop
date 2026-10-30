import { Guards, ValidationFailError, ValueObject } from '../../../shared';
import { RuleType } from './RuleType';

export class RuleValue extends ValueObject {
    constructor(value, type = 'manual_input') {
        super('rule_value', value);

        if (value === null || value === undefined) {
            throw new ValidationFailError('The value cannot be null', this.field);
        }

        this.#ensureValidValue(value, type);
    }

    #ensureValidValue(value, type) {
        if (type === RuleType.FUNCTION.value) {
            const validFunctionValues = ['date', 'time', 'datetime'];
            if (!validFunctionValues.includes(value)) {
                throw new ValidationFailError(
                    `Invalid value "${value}" for type "function". Must be one of: ${validFunctionValues.join(', ')}`,
                    this.field
                );
            }
        } else {
            Guards.stringType(this);
        }
    }
}
