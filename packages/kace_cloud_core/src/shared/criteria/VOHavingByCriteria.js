import { InvalidArgumentError } from '../errors/InvalidArgumentError.js';
import { Guards } from '../domain/guards/Guards.js';
import { ValueObject } from '../domain/value-object/ValueObject.js';
import { ValueObjectString } from '../domain/value-object/ValueObjectString.js';
import { COMPARISION_OPERATORS } from './FilterOperator.js';
import { Helper } from '../index.js';

export class VOHavingByCriteria extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!nullable && !value) {
            throw new InvalidArgumentError(`${this.field}: The value cannot be null`);
        }
        if (nullable && !value) {
            return;
        }

        Guards.arrayType(this);
        if (value && value.length === 0 && !nullable) {
            throw new Error(`${this.field}: The array cannot be empty`);
        }

        this.havingProperties(value);
    }

    havingProperties(value) {
        value.forEach((condition) => {
            try {
                new ValueObjectString(this.field, condition.column);
                if (!COMPARISION_OPERATORS[condition.operator] || !condition.hasOwnProperty('value')) {
                    throw new Error(`${this.field}: must have a valid operator and value property`);
                }
            } catch (error) {
                Helper.logError(error);
                throw new Error(`${this.field}: ${error.message}`);
            }
        });
    }
}
