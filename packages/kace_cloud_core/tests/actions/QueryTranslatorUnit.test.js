import { CompositeRule } from '../../src/actions/domain/QueryTranslator/CompositeRule';
import { Rule } from '../../src/actions/domain/QueryTranslator/Rule';
import { RuleCombinator } from '../../src/actions/domain/QueryTranslator/RuleCombinator';
import { RuleField } from '../../src/actions/domain/QueryTranslator/RuleField';
import { RuleOperator } from '../../src/actions/domain/QueryTranslator/RuleOperator';
import { RuleValue } from '../../src/actions/domain/QueryTranslator/RuleValue';
import { RuleType } from '../../src/actions/domain/QueryTranslator/RuleType';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError';

describe('RuleOperator', () => {
    it('should create a valid RuleOperator instance', () => {
        const operator = new RuleOperator(RuleOperator.EQUALS);
        expect(operator.value).toBe(RuleOperator.EQUALS);
    });

    it('should throw an error for invalid operator', () => {
        expect(() => new RuleOperator('invalid_operator')).toThrow(InvalidArgumentError);
        expect(() => new RuleOperator('invalid_operator')).toThrow('The rule operator invalid_operator is not valid');
    });

    it('should have a frozen instance', () => {
        const operator = new RuleOperator(RuleOperator.GREATER_THAN);
        expect(Object.isFrozen(operator)).toBe(true);
    });

    it('should return null for value if not set', () => {
        const operator = new RuleOperator(RuleOperator.NOT_NULL);
        expect(() => {
            operator.value = null;
        }).toThrow(new TypeError('Cannot set property value of #<RuleOperator> which has only a getter'));
    });

    it('should validate valid operators', () => {
        expect(RuleOperator.isValid(RuleOperator.LESS_THAN)).toBe(true);
        expect(RuleOperator.isValid(RuleOperator.NOT_IN)).toBe(true);
    });

    it('should invalidate invalid operators', () => {
        expect(RuleOperator.isValid('not_a_real_operator')).toBe(false);
        expect(RuleOperator.isValid('')).toBe(false);
    });

    it('should create from value', () => {
        const operator = RuleOperator.fromValue(RuleOperator.BETWEEN);
        expect(operator.value).toBe(RuleOperator.BETWEEN);
    });
});

describe('RuleCombinator', () => {
    it('should create a valid instance with AND combinator', () => {
        const combinator = new RuleCombinator(RuleCombinator.AND);
        expect(combinator.value).toBe(RuleCombinator.AND);
    });

    it('should create a valid instance with OR combinator', () => {
        const combinator = new RuleCombinator(RuleCombinator.OR);
        expect(combinator.value).toBe(RuleCombinator.OR);
    });

    it('should throw an error if the combinator is invalid', () => {
        expect(() => new RuleCombinator('invalid')).toThrow(InvalidArgumentError);
        expect(() => new RuleCombinator('invalid')).toThrow('The combinator invalid is not valid');
    });

    it('isValid should return true for valid combinators', () => {
        expect(RuleCombinator.isValid(RuleCombinator.AND)).toBe(true);
        expect(RuleCombinator.isValid(RuleCombinator.OR)).toBe(true);
    });

    it('isValid should return false for invalid combinators', () => {
        expect(RuleCombinator.isValid('invalid')).toBe(false);
        expect(RuleCombinator.isValid(null)).toBe(false);
    });

    it('fromValue should create a RuleCombinator from a valid value', () => {
        const combinator = RuleCombinator.fromValue(RuleCombinator.AND);
        expect(combinator.value).toBe(RuleCombinator.AND);
    });

    it('fromValue should throw an error if the value is invalid', () => {
        expect(() => RuleCombinator.fromValue('invalid')).toThrow(InvalidArgumentError);
    });
});

describe('Rule', () => {
    let field, operator, value, type, valueType;

    const validRule = {
        field: 'filed_1',
        operator: '=',
        value: 'test',
    };

    beforeEach(() => {
        field = new RuleField('field_1');
        operator = new RuleOperator(RuleOperator.EQUALS);
        value = new RuleValue('test');
        type = RuleType.fromValue('manual_input');
        valueType = 'text';
    });

    it('should create a valid Rule instance', () => {
        const rule = new Rule(field, operator, value, type, valueType);
        expect(rule.field).toBe(field);
        expect(rule.operator).toBe(operator);
        expect(rule.value).toBe(value);
    });

    it('should throw an error if field is invalid', () => {
        expect(() => {
            new Rule({}, operator, value);
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if operator is invalid', () => {
        expect(() => {
            new Rule(field, {}, value);
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if value is invalid', () => {
        expect(() => {
            new Rule(field, operator, {});
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if type is invalid', () => {
        expect(() => {
            new Rule(field, operator, value, {});
        }).toThrow('Rule Type must be an instance of RuleType');
    });

    it('should throw an error if valueType is not one of text, number or date', () => {
        expect(() => {
            new Rule(field, operator, value, type, 'not_a_real_value_type');
        }).toThrow('Invalid valueType: not_a_real_value_type. Must be one of text, number, date');
    });

    it('should validate parameters correctly', () => {
        const rule = new Rule(field, operator, value, type, valueType);
        expect(rule.validate(field, operator, value, type, valueType)).toBeUndefined();
    });

    it('should create a Rule instance from a plain object', () => {
        const rule = Rule.fromValue(validRule);
        expect(rule.field).toBeInstanceOf(RuleField);
        expect(rule.operator).toBeInstanceOf(RuleOperator);
        expect(rule.value).toBeInstanceOf(RuleValue);
    });

    it('should throw an error if field is invalid', () => {
        expect(() => {
            Rule.fromValue({ ...validRule, field: {} });
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if operator is invalid', () => {
        expect(() => {
            Rule.fromValue({ ...validRule, operator: {} });
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if value is invalid', () => {
        expect(() => {
            Rule.fromValue({ ...validRule, value: {} });
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if params are missing', () => {
        expect(() => {
            Rule.fromValue();
        }).toThrow();
    });

    it('should handle empty values correctly', () => {
        const rule = Rule.fromValue({ ...validRule, value: '' });
        expect(rule).toBeInstanceOf(Rule);
        expect(rule.value).toBeDefined();
    });
});

describe('RuleValue', () => {
    it('should throw an error if the value is null', () => {
        expect(() => new RuleValue(null)).toThrow('The value cannot be null');
    });

    it('should throw an error if the value is undefined', () => {
        expect(() => new RuleValue(undefined)).toThrow('The value cannot be null');
    });

    it('should throw an error for a function-type value outside date/time/datetime', () => {
        expect(() => new RuleValue('bogus_function', RuleType.FUNCTION.value)).toThrow(
            'Invalid value "bogus_function" for type "function". Must be one of: date, time, datetime'
        );
    });

    it.each(['date', 'time', 'datetime'])('should accept "%s" as a valid function-type value', (validFunctionValue) => {
        const ruleValue = new RuleValue(validFunctionValue, RuleType.FUNCTION.value);
        expect(ruleValue.value).toBe(validFunctionValue);
    });

    it('should throw an error for a non-string value when type is not "function"', () => {
        expect(() => new RuleValue(42, RuleType.MANUAL_INPUT.value)).toThrow();
    });
});

describe('CompositeRule', () => {
    let rule1, rule2, combinator;

    const validCompositeRule = {
        rules: [
            { field: 'field_1', operator: '=', value: 'test1' },
            { field: 'field_2', operator: '=', value: 'test2' },
        ],
        combinator: 'and',
    };

    beforeEach(() => {
        rule1 = new Rule(
            new RuleField('field_1'),
            new RuleOperator(RuleOperator.EQUALS),
            new RuleValue('test'),
            RuleType.fromValue('manual_input'),
            'text'
        );
        rule2 = new Rule(
            new RuleField('field_1'),
            new RuleOperator(RuleOperator.EQUALS),
            new RuleValue(''),
            RuleType.fromValue('manual_input'),
            'text'
        );
        combinator = new RuleCombinator(RuleCombinator.AND);
    });

    it('should create a CompositeRule instance with valid rules and combinator', () => {
        const compositeRule = new CompositeRule([rule1, rule2], combinator);
        expect(compositeRule.rules).toEqual([rule1, rule2]);
        expect(compositeRule.combinator).toBe(combinator);
    });

    it('should throw an error if rules are not an array', () => {
        expect(() => {
            new CompositeRule({}, combinator);
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if rules contain invalid instances', () => {
        const invalidRule = {};
        expect(() => {
            new CompositeRule([rule1, invalidRule], combinator);
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if combinator is invalid', () => {
        expect(() => {
            new CompositeRule([rule1, rule2], {});
        }).toThrow(InvalidArgumentError);
    });

    it('should freeze the instance', () => {
        const compositeRule = new CompositeRule([rule1, rule2], combinator);
        expect(() => {
            compositeRule.rules = [];
        }).toThrow(TypeError);
    });

    it('should create a CompositeRule from a valid object', () => {
        const compositeRule = CompositeRule.fromValue(validCompositeRule);
        expect(compositeRule).toBeInstanceOf(CompositeRule);
        expect(compositeRule.rules).toHaveLength(2);
        expect(compositeRule.combinator).toBeInstanceOf(RuleCombinator);
    });

    it('should create a CompositeRule from a extend valid object', () => {
        const extendCompositeRule = { ...validCompositeRule };
        extendCompositeRule.rules.push({
            rules: [
                { field: 'field_3', operator: '=', value: 'test1' },
                { field: 'field_4', operator: '=', value: 'test2' },
            ],
            combinator: 'or',
        });
        const compositeRule = CompositeRule.fromValue(extendCompositeRule);
        const instanceCompositeRule = compositeRule.rules[2];

        expect(compositeRule).toBeInstanceOf(CompositeRule);
        expect(compositeRule.rules).toHaveLength(3);
        expect(compositeRule.combinator).toBeInstanceOf(RuleCombinator);
        expect(compositeRule.rules[2]).toBeInstanceOf(CompositeRule);
        expect(instanceCompositeRule.rules[0]).toBeInstanceOf(Rule);
    });

    it('should throw an error when input to fromValue is not an object', () => {
        expect(() => {
            CompositeRule.fromValue('invalid');
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if rules in fromValue are not an array', () => {
        const input = { rules: {}, combinator: 'and' };
        expect(() => {
            CompositeRule.fromValue(input);
        }).toThrow(InvalidArgumentError);
    });

    it('should throw an error if combinator is missing in fromValue', () => {
        expect(() => {
            CompositeRule.fromValue({ ...validCompositeRule, combinator: undefined });
        }).toThrow(InvalidArgumentError);
    });

    it('should correctly parse rules and combinator from fromValue', () => {
        const compositeRule = CompositeRule.fromValue(validCompositeRule);
        expect(compositeRule.rules[0]).toBeInstanceOf(Rule);
        expect(compositeRule.rules[1]).toBeInstanceOf(Rule);
        expect(compositeRule.combinator).toBeInstanceOf(RuleCombinator);
    });
});
