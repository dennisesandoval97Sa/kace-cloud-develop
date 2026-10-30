import { RuleType } from '../../src/actions/domain/QueryTranslator/RuleType.js';
import { ValidationFailError } from '../../src/shared/index.js';

describe('RuleType', () => {
    it('should throw when constructed with an invalid value', () => {
        expect(() => new RuleType('BOGUS', 'not_a_real_type')).toThrow(
            'The value must be a valid RuleType: not_a_real_type'
        );
    });

    describe('fromValue', () => {
        it.each([
            ['manual_input', RuleType.MANUAL_INPUT],
            ['options_list', RuleType.OPTIONS_LIST],
            ['entity', RuleType.ENTITY],
            ['function', RuleType.FUNCTION],
        ])('maps "%s" to the matching singleton', (value, expected) => {
            expect(RuleType.fromValue(value)).toBe(expected);
        });

        it('should throw a ValidationFailError for an unknown value', () => {
            expect(() => RuleType.fromValue('not_a_real_type')).toThrow(ValidationFailError);
            expect(() => RuleType.fromValue('not_a_real_type')).toThrow('Invalid rule type: not_a_real_type');
        });
    });

    describe('toJson', () => {
        it('should return the value of every static RuleType instance, keyed by its static name', () => {
            expect(RuleType.toJson()).toEqual({
                MANUAL_INPUT: 'manual_input',
                OPTIONS_LIST: 'options_list',
                ENTITY: 'entity',
                FUNCTION: 'function',
            });
        });
    });
});
