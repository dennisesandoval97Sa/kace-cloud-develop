import { RuleOperator } from './RuleOperator';
import { RuleField } from './RuleField';
import { RuleValue } from './RuleValue';
import { RuleType } from './RuleType';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';
import { Helper } from '../../../shared/index.js';

export class Rule {
    /**
     * Constructs a new instance of Rule.
     *
     * @param {FilterField} field - The field to which the rule applies.
     * @param {RuleOperator} operator - The operator that defines the condition.
     * @param {RuleValue} value - The value to be compared against the field.
     * @param {RuleType} type - The value to be compared against the field.
     *
     * @throws {InvalidArgumentError} If any of the arguments are not of the expected types.
     */
    constructor(field, operator, value, type, valueType = 'text') {
        this.validate(field, operator, value, type, valueType);
        this.field = field;
        this.operator = operator;
        this.value = value;
        this.type = type;
        this.valueType = valueType;
    }

    /**
     * Validates the parameters.
     *
     * @param {FilterField} field - The field to validate.
     * @param {RuleOperator} operator - The operator to validate.
     * @param {RuleValue} value - The value to validate.
     *
     * @throws {InvalidArgumentError} If the parameters are not instances of the expected classes.
     */
    validate(field, operator, value, type, valueType) {
        if (!(field instanceof RuleField)) {
            throw new InvalidArgumentError('Rule Field must be an instance of FilterField');
        }

        if (!(operator instanceof RuleOperator)) {
            throw new InvalidArgumentError('Rule Operator must be an instance of RuleOperator');
        }

        if (!(value instanceof RuleValue)) {
            throw new InvalidArgumentError('Rule Value must be an instance of RuleValue or null/undefined');
        }

        if (!(type instanceof RuleType)) {
            throw new InvalidArgumentError('Rule Type must be an instance of RuleType');
        }

        const validValueTypes = ['text', 'number', 'date'];
        if (!validValueTypes.includes(valueType)) {
            throw new InvalidArgumentError(
                `Invalid valueType: ${valueType}. Must be one of ${validValueTypes.join(', ')}`
            );
        }
    }

    /**
     * Creates a new Rule instance from a plain object.
     *
     * @param {Object} params - An object containing the field, operator, and value.
     * @param {Object} params.field - The field to apply the rule.
     * @param {Object} params.operator - The operator to use in the rule.
     * @param {Object} params.value - The value to compare.
     * @param {Object} params.type - The type of the rule.
     * @param {Object} params.value_type - The valueType for compare.
     *
     * @returns {Rule} A new instance of Rule created from the provided values.
     */
    static fromValue({ field, operator, value, type, value_type }) {
        const safeType = type || 'manual_input';
        const safeValueType = value_type || 'text';
        const safeValue = value ?? '';

        Helper.logDebug2('Rule.fromValue', field, operator, safeValue, safeType);
        const parsedField = new RuleField(field);
        const parsedOperator = new RuleOperator(operator);
        const parsedType = RuleType.fromValue(safeType);
        const parsedValue = new RuleValue(safeValue, safeType);
        return new Rule(parsedField, parsedOperator, parsedValue, parsedType, safeValueType);
    }

    toJson() {
        return {
            field: this.field.value,
            operator: this.operator.value,
            value: this.value.value,
            type: this.type.value,
            value_type: this.valueType,
        };
    }
}
