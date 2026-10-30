import { CompositeRule } from '../../src/actions/domain/QueryTranslator/CompositeRule';
import { InvalidArgumentError, ValidationFailError } from '../../src/shared';
import { RuleOperator } from '../../src/actions/domain/QueryTranslator/RuleOperator';
import { Rule } from '../../src/actions/domain/QueryTranslator/Rule';
import { RuleValidator } from '../../src/actions/domain/QueryTranslator/RuleValidator';
import { RuleCombinator } from '../../src/actions/domain/QueryTranslator/RuleCombinator';
import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc.js';
import dayjsTimezone from 'dayjs/plugin/timezone.js';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);

/**
 * `RuleValueCalculator` no resuelve la funcion `time` con el reloj local del
 * proceso: usa la instancia que `DayjsFactory` congela al cargar el modulo, y
 * esa queda fijada a `process.env.TIMEZONE` (America/Bogota por defecto).
 */
const RULE_TIMEZONE = process.env.TIMEZONE ?? 'America/Bogota';

describe('RuleValidatorUnit Tests', () => {
    describe('Compare values', () => {
        describe('validateOperator', () => {
            it('should return true for NULL operator when fieldValue is null', () => {
                expect(RuleValidator.validateOperator(null, null, RuleOperator.NULL)).toBe(true);
            });

            it('should return true for NULL operator when fieldValue is undefined', () => {
                expect(RuleValidator.validateOperator(undefined, null, RuleOperator.NULL)).toBe(true);
            });

            it('should return false for NOT_NULL operator when fieldValue is null', () => {
                expect(RuleValidator.validateOperator(null, null, RuleOperator.NOT_NULL)).toBe(false);
            });

            it('should return true for NOT_NULL operator when fieldValue is a valid value', () => {
                expect(RuleValidator.validateOperator(1, null, RuleOperator.NOT_NULL)).toBe(true);
            });

            it('should return true for IS_EMPTY operator when fieldValue is an empty string', () => {
                expect(RuleValidator.validateOperator('', null, RuleOperator.IS_EMPTY)).toBe(true);
            });

            it('should return false for IS_EMPTY operator when fieldValue is a non-empty string', () => {
                expect(RuleValidator.validateOperator('abc', null, RuleOperator.IS_EMPTY)).toBe(false);
            });

            it('should return false for IS_EMPTY operator when fieldValue is null or undefined', () => {
                expect(RuleValidator.validateOperator(null, null, RuleOperator.IS_EMPTY)).toBe(false);
                expect(RuleValidator.validateOperator(undefined, null, RuleOperator.IS_EMPTY)).toBe(false);
            });

            it('should return true for IS_NOT_EMPTY operator when fieldValue is a non-empty string', () => {
                expect(RuleValidator.validateOperator('abc', null, RuleOperator.IS_NOT_EMPTY)).toBe(true);
            });

            it('should return false for IS_NOT_EMPTY operator when fieldValue is empty, null or undefined', () => {
                expect(RuleValidator.validateOperator('', null, RuleOperator.IS_NOT_EMPTY)).toBe(false);
                expect(RuleValidator.validateOperator(null, null, RuleOperator.IS_NOT_EMPTY)).toBe(false);
                expect(RuleValidator.validateOperator(undefined, null, RuleOperator.IS_NOT_EMPTY)).toBe(false);
            });
        });

        describe('Valueless operators built from frontend payload (empty type/value/value_type)', () => {
            const buildAndValidate = (operator, context) => {
                const compositeRule = CompositeRule.fromValue({
                    combinator: 'and',
                    rules: [{ field: 'cases.titulo', operator, type: '', value: '', value_type: '' }],
                });
                return RuleValidator.validate(compositeRule, context, null);
            };

            it('should not throw when building isEmpty/isNotEmpty/null/notNull rules with empty strings', () => {
                expect(() => buildAndValidate(RuleOperator.IS_EMPTY, { cases: { titulo: '' } })).not.toThrow();
                expect(() => buildAndValidate(RuleOperator.IS_NOT_EMPTY, { cases: { titulo: 'x' } })).not.toThrow();
                expect(() => buildAndValidate(RuleOperator.NULL, { cases: { titulo: null } })).not.toThrow();
                expect(() => buildAndValidate(RuleOperator.NOT_NULL, { cases: { titulo: 'x' } })).not.toThrow();
            });

            it('should evaluate isEmpty as true when the field is an empty string', () => {
                expect(buildAndValidate(RuleOperator.IS_EMPTY, { cases: { titulo: '' } })).toBe(true);
                expect(buildAndValidate(RuleOperator.IS_EMPTY, { cases: { titulo: 'abc' } })).toBe(false);
            });

            it('should evaluate isNotEmpty, null and notNull correctly', () => {
                expect(buildAndValidate(RuleOperator.IS_NOT_EMPTY, { cases: { titulo: 'abc' } })).toBe(true);
                expect(buildAndValidate(RuleOperator.IS_NOT_EMPTY, { cases: { titulo: '' } })).toBe(false);
                expect(buildAndValidate(RuleOperator.NULL, { cases: { titulo: null } })).toBe(true);
                expect(buildAndValidate(RuleOperator.NOT_NULL, { cases: { titulo: 'abc' } })).toBe(true);
            });

            it('should also build correctly when type/value_type are omitted', () => {
                const compositeRule = CompositeRule.fromValue({
                    combinator: 'and',
                    rules: [{ field: 'cases.titulo', operator: RuleOperator.IS_EMPTY, value: '' }],
                });
                expect(RuleValidator.validate(compositeRule, { cases: { titulo: '' } }, null)).toBe(true);
            });
        });

        describe('Comparison operators', () => {
            it('should return true for EQUALS operator when fieldValue equals ruleValue', () => {
                expect(RuleValidator.validateOperator(5, 5, RuleOperator.EQUALS)).toBe(true);
            });

            it('should return false for EQUALS operator when fieldValue does not equal ruleValue', () => {
                expect(RuleValidator.validateOperator(5, 10, RuleOperator.EQUALS)).toBe(false);
            });

            it('should return true for NOT_EQUALS operator when fieldValue does not equal ruleValue', () => {
                expect(RuleValidator.validateOperator(5, 10, RuleOperator.NOT_EQUALS)).toBe(true);
            });

            it('should return false for NOT_EQUALS operator when fieldValue equals ruleValue', () => {
                expect(RuleValidator.validateOperator(5, 5, RuleOperator.NOT_EQUALS)).toBe(false);
            });

            it('should return true for LESS_THAN operator when fieldValue is less than ruleValue', () => {
                expect(RuleValidator.validateOperator('5', '10', RuleOperator.LESS_THAN, 'number')).toBe(true);
            });

            it('should return false for LESS_THAN operator when fieldValue is not less than ruleValue', () => {
                expect(RuleValidator.validateOperator('10', '5', RuleOperator.LESS_THAN, 'number')).toBe(false);
            });

            it('should return true for LESS_THAN_EQUAL operator when fieldValue is less than or equal to ruleValue', () => {
                expect(RuleValidator.validateOperator(5, '10', RuleOperator.LESS_THAN_EQUAL, 'number')).toBe(true);
                expect(RuleValidator.validateOperator('5', 5, RuleOperator.LESS_THAN_EQUAL)).toBe(true);
            });

            it('should return false for LESS_THAN_EQUAL operator when fieldValue is greater than ruleValue', () => {
                expect(RuleValidator.validateOperator(10, 5, RuleOperator.LESS_THAN_EQUAL, 'number')).toBe(false);
            });

            it('should return true for GREATER_THAN operator when fieldValue is greater than ruleValue', () => {
                expect(RuleValidator.validateOperator(10, 5, RuleOperator.GREATER_THAN, 'number')).toBe(true);
            });

            it('should return false for GREATER_THAN operator when fieldValue is not greater than ruleValue', () => {
                expect(RuleValidator.validateOperator(5, 10, RuleOperator.GREATER_THAN, 'number')).toBe(false);
            });

            it('should return true for GREATER_THAN_EQUAL operator when fieldValue is greater than or equal to ruleValue', () => {
                expect(RuleValidator.validateOperator(10, 5, RuleOperator.GREATER_THAN_EQUAL, 'number')).toBe(true);
                expect(RuleValidator.validateOperator(5, 5, RuleOperator.GREATER_THAN_EQUAL)).toBe(true);
            });

            it('should return false for GREATER_THAN_EQUAL operator when fieldValue is less than ruleValue', () => {
                expect(RuleValidator.validateOperator(3, 5, RuleOperator.GREATER_THAN_EQUAL)).toBe(false);
            });

            it('should return false for EQUALS when fieldValue is invalid number', () => {
                expect(RuleValidator.validateOperator('not-a-number', '10', RuleOperator.EQUALS, 'number')).toBe(false);
            });

            it('should return false for EQUALS when ruleValue is invalid number', () => {
                expect(RuleValidator.validateOperator('10', 'abc', RuleOperator.EQUALS, 'number')).toBe(false);
            });

            it('should return false for LESS_THAN when fieldValue is invalid number', () => {
                expect(RuleValidator.validateOperator('xyz', '10', RuleOperator.LESS_THAN, 'number')).toBe(false);
            });

            it('should return false for GREATER_THAN when ruleValue is invalid number', () => {
                expect(RuleValidator.validateOperator('10', 'invalid', RuleOperator.GREATER_THAN, 'number')).toBe(
                    false
                );
            });
        });

        describe('String-based operators', () => {
            it('should return true for CONTAINS operator when fieldValue contains ruleValue', () => {
                expect(RuleValidator.validateOperator('hello world', 'world', RuleOperator.CONTAINS)).toBe(true);
            });

            it('should return false for CONTAINS operator when fieldValue does not contain ruleValue', () => {
                expect(RuleValidator.validateOperator('hello world', 'moon', RuleOperator.CONTAINS)).toBe(false);
            });

            it('should return true for BEGINS_WITH operator when fieldValue begins with ruleValue', () => {
                expect(RuleValidator.validateOperator('hello world', 'hello', RuleOperator.BEGINS_WITH)).toBe(true);
            });

            it('should return false for BEGINS_WITH operator when fieldValue does not begin with ruleValue', () => {
                expect(RuleValidator.validateOperator('hello world', 'world', RuleOperator.BEGINS_WITH)).toBe(false);
            });

            it('should return true for ENDS_WITH operator when fieldValue ends with ruleValue', () => {
                expect(RuleValidator.validateOperator('hello world', 'world', RuleOperator.ENDS_WITH)).toBe(true);
            });

            it('should return false for ENDS_WITH operator when fieldValue does not end with ruleValue', () => {
                expect(RuleValidator.validateOperator('hello world', 'hello', RuleOperator.ENDS_WITH)).toBe(false);
            });
        });

        describe('IN and NOT_IN operators', () => {
            it('should return true for IN operator when fieldValue is in ruleValue array', () => {
                expect(RuleValidator.validateOperator(3, '1, 2, 3', RuleOperator.IN)).toBe(true);
            });

            it('should return false for IN operator when fieldValue is not in ruleValue array', () => {
                expect(RuleValidator.validateOperator(4, '1, 2, 3', RuleOperator.IN)).toBe(false);
            });

            it('should return true for NOT_IN operator when fieldValue is not in ruleValue array', () => {
                expect(RuleValidator.validateOperator(4, '1, 2, 3', RuleOperator.NOT_IN)).toBe(true);
            });

            it('should return false for NOT_IN operator when fieldValue is in ruleValue array', () => {
                expect(RuleValidator.validateOperator(3, '1, 2, 3', RuleOperator.NOT_IN)).toBe(false);
            });

            it('should return true for IN when fieldValue is valid number in the list', () => {
                expect(RuleValidator.validateOperator('5', '1, 5, 10', RuleOperator.IN, 'number')).toBe(true);
            });

            it('should return true for IN when fieldValue matches a valid date in the list', () => {
                expect(
                    RuleValidator.validateOperator('2025-01-01', '2025-01-01, 2025-01-02', RuleOperator.IN, 'date')
                ).toBe(true);
            });

            it('should return false for IN when fieldValue is invalid number', () => {
                expect(RuleValidator.validateOperator('not-a-number', '1, 2, 3', RuleOperator.IN, 'number')).toBe(
                    false
                );
            });

            it('should return false for IN when fieldValue is invalid date', () => {
                expect(
                    RuleValidator.validateOperator('invalid-date', '2025-01-01, 2025-01-02', RuleOperator.IN, 'date')
                ).toBe(false);
            });
        });

        describe('BETWEEN and NOT_BETWEEN operators', () => {
            it('should return true for BETWEEN operator when fieldValue is between ruleValue range', () => {
                expect(RuleValidator.validateOperator(5, '1, 10', RuleOperator.BETWEEN, 'number')).toBe(true);
            });

            it('should return false for BETWEEN operator when fieldValue is not between ruleValue range', () => {
                expect(RuleValidator.validateOperator(15, '1, 10', RuleOperator.BETWEEN)).toBe(false);
            });

            it('should return true for NOT_BETWEEN operator when fieldValue is not between ruleValue range', () => {
                expect(RuleValidator.validateOperator(15, '1, 10', RuleOperator.NOT_BETWEEN)).toBe(true);
            });

            it('should return false for NOT_BETWEEN operator when fieldValue is between ruleValue range', () => {
                expect(RuleValidator.validateOperator(5, '1, 10', RuleOperator.NOT_BETWEEN, 'number')).toBe(false);
            });

            it('should throw an error if BETWEEN operator does not have exactly 2 values in ruleValue', () => {
                expect(() => RuleValidator.validateOperator(5, '1', RuleOperator.BETWEEN)).toThrow(
                    InvalidArgumentError
                );
            });

            it('should throw an error if NOT_BETWEEN operator does not have exactly 2 values in ruleValue', () => {
                expect(() => RuleValidator.validateOperator(5, '1', RuleOperator.NOT_BETWEEN)).toThrow(
                    InvalidArgumentError
                );
            });
        });

        describe('Unsupported operators', () => {
            it('should throw an error for unsupported operator', () => {
                expect(() => RuleValidator.validateOperator(5, 10, 'UNSUPPORTED')).toThrowError(InvalidArgumentError);
            });
        });
    });

    describe('getFieldValue', () => {
        const context = {
            aux_casos: {
                form1: {
                    city: 'Barcelona',
                    address: {
                        street: 'Diagonal',
                        number: 500,
                    },
                },
                form2: {
                    city: 'Madrid',
                    address: null,
                },
                form3: {
                    isActive: false,
                    isVerified: true,
                },
            },
        };

        it('should return the correct value for a nested field path', () => {
            const result = RuleValidator.getFieldValue('aux_casos.form1.city', context);
            expect(result).toBe('Barcelona');
        });

        it('should return undefined if the field path is invalid (non-existing)', () => {
            const result = RuleValidator.getFieldValue('aux_casos.form1.zipCode', context);
            expect(result).toBeUndefined();
        });

        it('should return the correct value for a deeply nested field path', () => {
            const result = RuleValidator.getFieldValue('aux_casos.form1.address.street', context);
            expect(result).toBe('Diagonal');
        });

        it('should throw an error if the field path is empty', () => {
            expect(() => RuleValidator.getFieldValue('', context)).toThrow(InvalidArgumentError);
            expect(() => RuleValidator.getFieldValue(null, context)).toThrow(InvalidArgumentError);
        });

        it('should return undefined if an intermediate object is undefined', () => {
            const result = RuleValidator.getFieldValue('aux_casos.form3.city', context);
            expect(result).toBeUndefined();
        });

        it('should return undefined if an intermediate object is null', () => {
            const result = RuleValidator.getFieldValue('aux_casos.form4.address.street', context);
            expect(result).toBeUndefined();
        });

        it('should return undefined if the final property value is undefined', () => {
            const result = RuleValidator.getFieldValue('aux_casos.form1.address.zipCode', context);
            expect(result).toBeUndefined();
        });

        it('should return false when the field value is explicitly false', () => {
            const result = RuleValidator.getFieldValue('aux_casos.form3.isActive', context);
            expect(result).toBe(false);
        });
    });

    describe('Composite Rule validation', () => {
        const context = {
            nivel4: '1',
            antiguedad_horas: 123,
            campos_extra2: '1',
        };

        it('should validate composite rule with AND combinator', () => {
            const rule1 = Rule.fromValue({
                field: 'nivel4',
                value: '1',
                operator: '=',
            });

            const rule2 = Rule.fromValue({
                field: 'campos_extra2',
                value: '1',
                operator: '=',
            });

            const compositeRule = new CompositeRule([rule1, rule2], new RuleCombinator(RuleCombinator.AND));

            const result = RuleValidator.validate(compositeRule, context);
            expect(result).toBe(true);
        });

        it('should return false for composite rule with AND combinator if one rule fails', () => {
            const rule1 = Rule.fromValue({
                field: 'nivel4',
                value: '2',
                operator: '=',
            });

            const rule2 = Rule.fromValue({
                field: 'campos_extra2',
                value: '1',
                operator: '=',
            });

            const compositeRule = new CompositeRule([rule1, rule2], new RuleCombinator(RuleCombinator.AND));

            const result = RuleValidator.validate(compositeRule, context);
            expect(result).toBe(false);
        });

        it('should validate composite rule with OR combinator', () => {
            const rule1 = Rule.fromValue({
                field: 'nivel4',
                value: '2',
                operator: '=',
            });

            const rule2 = Rule.fromValue({
                field: 'campos_extra2',
                value: '1',
                operator: '=',
            });

            const compositeRule = new CompositeRule([rule1, rule2], new RuleCombinator(RuleCombinator.OR));

            const result = RuleValidator.validate(compositeRule, context);
            expect(result).toBe(true);
        });

        it('should return false for composite rule with OR combinator if all rules fail', () => {
            const rule1 = Rule.fromValue({
                field: 'nivel4',
                value: '3',
                operator: '=',
            });

            const rule2 = Rule.fromValue({
                field: 'campos_extra2',
                value: '2',
                operator: '=',
            });

            const compositeRule = new CompositeRule([rule1, rule2], new RuleCombinator(RuleCombinator.OR));

            const result = RuleValidator.validate(compositeRule, context);
            expect(result).toBe(false);
        });
    });

    describe('Complex Rule Validation', () => {
        const context = {
            antiguedad_dias: '5',
            nombres: 'Juan Carlos',
            apellido1: 'Pérez López',
        };

        it('should return true for valid complex rule with AND/OR', () => {
            const compositeRules = CompositeRule.fromValue({
                combinator: 'and',
                rules: [
                    { field: 'antiguedad_dias', operator: RuleOperator.EQUALS, value: '5' },
                    {
                        combinator: 'or',
                        rules: [
                            { field: 'nombres', operator: RuleOperator.CONTAINS, value: 'Juan' },
                            { field: 'apellido1', operator: RuleOperator.CONTAINS, value: 'Pérez' },
                        ],
                    },
                ],
            });

            const result = RuleValidator.validate(compositeRules, context);
            expect(result).toBe(true);
        });

        it('should return false if the first condition fails (antiguedad_dias)', () => {
            const contextWithInvalidAntiguedad = { ...context, antiguedad_dias: 4 };

            const compositeRules = CompositeRule.fromValue({
                combinator: 'and',
                rules: [
                    { field: 'antiguedad_dias', operator: RuleOperator.EQUALS, value: '5' },
                    {
                        combinator: 'or',
                        rules: [
                            { field: 'nombres', operator: RuleOperator.CONTAINS, value: 'Juan' },
                            { field: 'apellido1', operator: RuleOperator.CONTAINS, value: 'Pérez' },
                        ],
                    },
                ],
            });

            const result = RuleValidator.validate(compositeRules, contextWithInvalidAntiguedad);
            expect(result).toBe(false);
        });

        it('should return false if the OR condition fails (both names and surname)', () => {
            const contextWithInvalidNames = { ...context, nombres: 'Carlos', apellido1: 'Gomez' };

            const compositeRules = CompositeRule.fromValue({
                combinator: 'and',
                rules: [
                    { field: 'antiguedad_dias', operator: RuleOperator.EQUALS, value: '5' },
                    {
                        combinator: 'or',
                        rules: [
                            { field: 'nombres', operator: RuleOperator.CONTAINS, value: 'Juan' },
                            { field: 'apellido1', operator: RuleOperator.CONTAINS, value: 'Pérez' },
                        ],
                    },
                ],
            });

            const result = RuleValidator.validate(compositeRules, contextWithInvalidNames);
            expect(result).toBe(false);
        });

        it('should return false if neither condition in OR is satisfied', () => {
            const contextWithInvalidValues = { ...context, nombres: 'Carlos', apellido1: 'Gomez' };

            const compositeRules = CompositeRule.fromValue({
                combinator: 'and',
                rules: [
                    { field: 'antiguedad_dias', operator: RuleOperator.EQUALS, value: '5' },
                    {
                        combinator: 'or',
                        rules: [
                            { field: 'nombres', operator: RuleOperator.CONTAINS, value: 'Juan' },
                            { field: 'apellido1', operator: RuleOperator.CONTAINS, value: 'Pérez' },
                        ],
                    },
                ],
            });

            const result = RuleValidator.validate(compositeRules, contextWithInvalidValues);
            expect(result).toBe(false);
        });

        it('should return true if both OR conditions are satisfied', () => {
            const contextWithValidBothOrConditions = { ...context, nombres: 'Juan Carlos', apellido1: 'Pérez López' };

            const compositeRules = CompositeRule.fromValue({
                combinator: 'and',
                rules: [
                    { field: 'antiguedad_dias', operator: RuleOperator.EQUALS, value: '5' },
                    {
                        combinator: 'or',
                        rules: [
                            { field: 'nombres', operator: RuleOperator.CONTAINS, value: 'Juan' },
                            { field: 'apellido1', operator: RuleOperator.CONTAINS, value: 'Pérez' },
                        ],
                    },
                ],
            });

            const result = RuleValidator.validate(compositeRules, contextWithValidBothOrConditions);
            expect(result).toBe(true);
        });

        it('should throw an error for invalid rule', () => {
            const invalidRule = { field: 'antiguedad_dias' };
            expect(() => {
                RuleValidator.validate(invalidRule, context);
            }).toThrow(InvalidArgumentError);
        });

        it('should throw when context is not a valid object', () => {
            const rule = Rule.fromValue({ field: 'antiguedad_dias', operator: '=', value: '5' });

            expect(() => RuleValidator.validate(rule, null)).toThrow('Context must be a valid object');
            expect(() => RuleValidator.validate(rule, 'not-an-object')).toThrow('Context must be a valid object');
        });

        it('should throw for an unsupported combinator (defensive check on validateCompositeRule)', () => {
            // RuleCombinator only accepts 'and'/'or', and CompositeRule is frozen after
            // construction, so no legitimately-constructed CompositeRule can ever carry an
            // unsupported combinator. `validateCompositeRule` is exercised directly here
            // (it does not itself check `instanceof CompositeRule`) to cover that defensive
            // fallback.
            const fakeCompositeRule = { rules: [], combinator: { value: 'xor' } };

            expect(() => RuleValidator.validateCompositeRule(fakeCompositeRule, context, null)).toThrow(
                'Unsupported combinator: xor'
            );
        });
    });

    describe('More Complex Rule Validation', () => {
        const context = {
            antiguedad_dias: '5',
            nombres: 'Juan Carlos',
            apellido1: 'Pérez López',
            edad: '30',
            ciudad: 'Madrid',
        };

        it('should return true for complex AND/OR combination with multiple fields', () => {
            const compositeRules = CompositeRule.fromValue({
                combinator: 'and',
                rules: [
                    { field: 'antiguedad_dias', operator: RuleOperator.GREATER_THAN, value: '3' },
                    { field: 'edad', operator: RuleOperator.LESS_THAN, value: '40' },
                    {
                        combinator: 'or',
                        rules: [
                            { field: 'nombres', operator: RuleOperator.CONTAINS, value: 'Alvaro' },
                            { field: 'apellido1', operator: RuleOperator.CONTAINS, value: 'Garcia' },
                            {
                                combinator: 'and',
                                rules: [
                                    { field: 'ciudad', operator: RuleOperator.EQUALS, value: 'Madrid' },
                                    { field: 'antiguedad_dias', operator: RuleOperator.EQUALS, value: '5' },
                                ],
                            },
                        ],
                    },
                ],
            });

            const result = RuleValidator.validate(compositeRules, context);
            expect(result).toBe(true);
        });

        it('should return false if the edad condition fails', () => {
            const contextWithInvalidEdad = { ...context, edad: '50' };

            const compositeRules = CompositeRule.fromValue({
                combinator: 'and',
                rules: [
                    { field: 'antiguedad_dias', operator: RuleOperator.GREATER_THAN, value: '3' },
                    { field: 'edad', operator: RuleOperator.LESS_THAN, value: '40' },
                    {
                        combinator: 'or',
                        rules: [
                            { field: 'nombres', operator: RuleOperator.CONTAINS, value: 'Juan' },
                            { field: 'apellido1', operator: RuleOperator.CONTAINS, value: 'Pérez' },
                            {
                                combinator: 'and',
                                rules: [
                                    { field: 'ciudad', operator: RuleOperator.EQUALS, value: 'Madrid' },
                                    { field: 'antiguedad_dias', operator: RuleOperator.EQUALS, value: '5' },
                                ],
                            },
                        ],
                    },
                ],
            });

            const result = RuleValidator.validate(compositeRules, contextWithInvalidEdad);
            expect(result).toBe(false);
        });
    });

    describe('complex nested structure in RuleValidator getFieldValue', () => {
        const context = {
            aux_casos: {
                proyectos: [
                    {
                        nombre: 'Proyecto Alpha',
                        fases: [
                            {
                                nombre_fase: 'Planificación',
                                tareas: [
                                    {
                                        descripcion: 'Análisis de requerimientos',
                                        recursos: [
                                            {
                                                nombre_recurso: 'Analista 1',
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
                mcc: 1234,
                ciiu: 5678,
                otro: 'Texto adicional',
                email: 'ejemplo@dominio.com',
                causal: 'No aplica',
                ciudad: 'Bogotá',
                cuenta_1: 11111111,
                cuenta_2: 22222222,
                cuenta_3: 33333333,
                extension: 101,
                respuesta: 'Aprobado',
                tasa_amex: 2.5,
                tasa_visa: 2.3,
                tipo_abono: 'Cuenta Corriente',
                tipo_venta: 'Presencial',
                departamento: 'Cundinamarca',
                observaciones: 'Observaciones generales del cliente',
                tipo_comercio: 'Minorista',
                tipo_cuenta_1: 'Corriente',
                tipo_cuenta_2: 'Ahorros',
                tipo_cuenta_3: 'Corriente',
                puntos_de_venta: [
                    {
                        cuenta_bancaria: 123456789,
                        direccion_punto_venta: 'Calle 123 #45-67',
                        rva_tipo_cuenta_bancaria: 'Corriente',
                    },
                ],
                tasa_mastercard: 2.4,
                campanyasActivas: 'Campaña verano',
                exportable_tasas: 'Sí',
                tipo_vinculacion: 'Online',
                telefono_contacto: 3101234567,
                cantidad_datafonos: 3,
                facturacion_mensual: 5000000,
                numero_puntos_venta: 1,
                vinculacion_exitosa: 'Sí',
                area_local_comercial: 'Centro Comercial ABC',
                dataGridAppointments: [
                    {
                        id: 'appt001',
                        date: '2025-07-14',
                        barrio: 'Chapinero',
                        franja: 'Mañana',
                        ksubmit: true,
                        direccion: 'Calle 100 #15-30',
                        punto_referencia: 'Frente a la estación',
                    },
                ],
                negociacion_comision: 'A convenir',
                perfiles_ocupaciones: 'Administrador',
                registro_fotografico: 'URL_imagen',
                rva_tipo_vinculacion: 'Física',
                valor_promedio_venta: 150000,
                actividad_alto_riesgo: false,
                vinculado_bancolombia: 'yes',
                codigo_unico_comercio_1: 987654,
                codigo_unico_comercio_2: 123456,
                codigo_unico_comercio_3: 234567,
                codigo_unico_comercio_4: 345678,
                codigo_unico_comercio_5: 456789,
                documentos_para_estudio: {
                    RUT: true,
                    'Camara de comercio': true,
                    'Documento de identidad': true,
                    'Registro fotografico eagle fachada': true,
                    'Formato de vinculacion adquirencia fotografico': true,
                },
                cuantas_personas_laboran: '5',
                cliente_acepta_perfilacion: 'yes',
                relacion_inmueble_vehiculo: 'Propietario',
                cliente_cumple_cobertura_adq: 'yes',
                cliente_deacuerdo_vinculacion: true,
                antiguedad_actividad_comercial: '2 años',
                comercio_actividad_alto_riesgo: 'no',
                fecha_nacimiento_representante: '1985-06-15',
            },
        };

        it('should return the correct value for a nested field path', () => {
            const result = RuleValidator.getFieldValue(
                'aux_casos.proyectos.fases.tareas.recursos.nombre_recurso',
                context
            );
            expect(result).toBe('Analista 1');
        });

        it('should return the correct value for a nested field path', () => {
            const result = RuleValidator.getFieldValue('aux_casos.proyectos.fases.nombre_fase', context);
            expect(result).toBe('Planificación');
        });

        it('should return the correct value for a nested field path', () => {
            const result = RuleValidator.getFieldValue('aux_casos.documentos_para_estudio.RUT', context);
            expect(result).toBe(true);
        });
    });

    describe('Rule with entity type', () => {
        const context = {
            edad: 25,
            ciudad: 'Madrid',
            usuario: {
                edad: 30,
                direccion: {
                    ciudad: 'Madrid',
                },
            },
        };

        it('should return true when entity path value equals field value', () => {
            const rule = Rule.fromValue({
                field: 'usuario.edad',
                value: 'usuario.edad',
                operator: RuleOperator.EQUALS,
                type: 'entity',
            });

            const result = RuleValidator.validate(rule, context);
            expect(result).toBe(true);
        });

        it('should return false when entity path value does not match field value', () => {
            const rule = Rule.fromValue({
                field: 'edad',
                value: 'usuario.edad',
                operator: RuleOperator.LESS_THAN,
                type: 'entity',
            });

            const result = RuleValidator.validate(rule, context);
            expect(result).toBe(true);
        });

        it('should handle nested entity paths', () => {
            const rule = Rule.fromValue({
                field: 'ciudad',
                value: 'usuario.direccion.ciudad',
                operator: RuleOperator.EQUALS,
                type: 'entity',
            });

            const result = RuleValidator.validate(rule, context);
            expect(result).toBe(true);
        });

        it('should return false if entity path does not exist', () => {
            const rule = Rule.fromValue({
                field: 'ciudad',
                value: 'usuario.direccion.pais',
                operator: RuleOperator.EQUALS,
                type: 'entity',
            });

            const result = RuleValidator.validate(rule, context);
            expect(result).toBe(false);
        });

        it('should validate composite rule with one entity and one normal value', () => {
            const rule1 = Rule.fromValue({
                field: 'edad',
                value: 'usuario.edad',
                operator: RuleOperator.EQUALS,
                type: 'entity',
            });

            const rule2 = Rule.fromValue({
                field: 'ciudad',
                value: 'Madrid',
                operator: RuleOperator.EQUALS,
            });

            const compositeRule = new CompositeRule([rule1, rule2], new RuleCombinator(RuleCombinator.AND));
            const context = {
                edad: 30,
                ciudad: 'Madrid',
                usuario: {
                    edad: 30,
                },
            };

            const result = RuleValidator.validate(compositeRule, context);
            expect(result).toBe(true);
        });
    });

    describe('Function-based Rule Validation', () => {
        const now = dayjs('2026-01-10 12:00:00');
        const currentDate = now.format('YYYY-MM-DD');
        const currentTime = now.format('HH:mm:ss');
        const currentDateTime = now.format('YYYY-MM-DD HH:mm:ss');

        const context = {
            fecha_actual: currentDate,
            hora_actual: currentTime,
            datetime_actual: currentDateTime,
            fecha_pasada: '2020-01-01',
            hora_pasada: '00:00:01',
            datetime_pasado: '2020-01-01 08:00:00',
            datetime_futuro: '2030-01-01 08:00:00',
            nested: {
                fecha_nested: currentDate,
                hora_nested: currentTime,
            },
        };

        describe('Date Functions', () => {
            it('should validate EQUALS with current date', () => {
                const rule = Rule.fromValue({
                    field: 'fecha_actual',
                    value: 'date',
                    operator: RuleOperator.EQUALS,
                    type: 'function',
                    value_type: 'date',
                });

                const contextWithUpdatedDate = { ...context, fecha_actual: dayjs().format('YYYY-MM-DD') };
                expect(RuleValidator.validate(rule, contextWithUpdatedDate)).toBe(true);
            });

            it('should validate GREATER_THAN with past date', () => {
                const rule = Rule.fromValue({
                    field: 'fecha_pasada',
                    value: 'date',
                    operator: RuleOperator.LESS_THAN,
                    type: 'function',
                    value_type: 'date',
                });

                expect(RuleValidator.validate(rule, context)).toBe(true);
            });

            it('should work with nested fields', () => {
                const rule = Rule.fromValue({
                    field: 'nested.fecha_nested',
                    value: 'date',
                    operator: RuleOperator.EQUALS,
                    type: 'function',
                    value_type: 'date',
                });

                const contextUpdated = {
                    ...context,
                    nested: {
                        fecha_nested: dayjs().format('YYYY-MM-DD'),
                    },
                };
                expect(RuleValidator.validate(rule, contextUpdated)).toBe(true);
            });

            it('should return false for manual_input date rule when field value is null', () => {
                const rule = Rule.fromValue({
                    field: 'fecha_null_manual',
                    value: '2025-01-01',
                    operator: RuleOperator.EQUALS,
                    type: 'manual_input',
                    value_type: 'date',
                });

                const ctx = { fecha_null_manual: null };
                expect(RuleValidator.validate(rule, ctx)).toBe(false);
            });

            it('should return false for manual_input date rule when field value is not a valid date string', () => {
                const rule = Rule.fromValue({
                    field: 'fecha_invalida_manual',
                    value: '2025-01-01',
                    operator: RuleOperator.EQUALS,
                    type: 'manual_input',
                    value_type: 'date',
                });

                const ctx = { fecha_invalida_manual: 'no-es-una-fecha' };
                expect(RuleValidator.validate(rule, ctx)).toBe(false);
            });

            it('should return false for function date rule when field value is null', () => {
                const rule = Rule.fromValue({
                    field: 'fecha_null_func',
                    value: 'date',
                    operator: RuleOperator.EQUALS,
                    type: 'function',
                    value_type: 'date',
                });

                const ctx = { fecha_null_func: null };
                expect(RuleValidator.validate(rule, ctx)).toBe(false);
            });

            it('should return false for function date rule when field value is not a valid date string', () => {
                const rule = Rule.fromValue({
                    field: 'fecha_invalida_func',
                    value: 'date',
                    operator: RuleOperator.EQUALS,
                    type: 'function',
                    value_type: 'date',
                });

                const ctx = { fecha_invalida_func: 'invalid-date-string' };
                expect(RuleValidator.validate(rule, ctx)).toBe(false);
            });

            it('should validate EQUALS with ISO 8601 datetime format with timezone', () => {
                const isoDateTime = dayjs().format('YYYY-MM-DDTHH:mm:ssZ');

                const rule = Rule.fromValue({
                    field: 'fecha_iso',
                    value: 'date',
                    operator: RuleOperator.EQUALS,
                    type: 'function',
                    value_type: 'date',
                });

                const ctx = {
                    fecha_iso: dayjs(isoDateTime).format('YYYY-MM-DD'),
                };

                expect(RuleValidator.validate(rule, ctx)).toBe(true);
            });

            it('should validate datetime comparison with ISO 8601 format', () => {
                const pastIsoDateTime = '2025-11-09T12:17:00-05:00';

                const rule = Rule.fromValue({
                    field: 'datetime_iso',
                    value: 'datetime',
                    operator: RuleOperator.LESS_THAN,
                    type: 'function',
                    value_type: 'date',
                });

                const ctx = {
                    datetime_iso: pastIsoDateTime,
                };

                expect(RuleValidator.validate(rule, ctx)).toBe(true);
            });
        });

        describe('Number type validation', () => {
            it('should return false when field value is null for number type', () => {
                const rule = Rule.fromValue({
                    field: 'numero_null',
                    value: '10',
                    operator: RuleOperator.EQUALS,
                    type: 'manual_input',
                    value_type: 'number',
                });

                const ctx = { numero_null: null };
                expect(RuleValidator.validate(rule, ctx)).toBe(false);
            });

            it('should return false when field value is not a valid number', () => {
                const rule = Rule.fromValue({
                    field: 'numero_invalido',
                    value: '10',
                    operator: RuleOperator.EQUALS,
                    type: 'manual_input',
                    value_type: 'number',
                });

                const ctx = { numero_invalido: 'abc' };
                expect(RuleValidator.validate(rule, ctx)).toBe(false);
            });

            it('should return true for valid number comparison', () => {
                const rule = Rule.fromValue({
                    field: 'numero_valido',
                    value: '10',
                    operator: RuleOperator.LESS_THAN,
                    type: 'manual_input',
                    value_type: 'number',
                });

                const ctx = { numero_valido: '5' };
                expect(RuleValidator.validate(rule, ctx)).toBe(true);
            });

            it('should return true when field value is numeric string', () => {
                const rule = Rule.fromValue({
                    field: 'numero_string',
                    value: '10',
                    operator: RuleOperator.EQUALS,
                    type: 'manual_input',
                    value_type: 'number',
                });

                const ctx = { numero_string: '10' };
                expect(RuleValidator.validate(rule, ctx)).toBe(true);
            });
        });

        describe('Time Functions', () => {
            it('should validate EQUALS with current time', () => {
                const rule = Rule.fromValue({
                    field: 'hora_actual',
                    value: 'time',
                    operator: RuleOperator.EQUALS,
                    type: 'function',
                    value_type: 'date',
                });

                // Con TZ=America/Mexico_City el `HH:mm:ss` del contexto iba una hora
                // por detras del que calcula la regla. `evaluationNow` ademas fija el
                // instante para que la igualdad no dependa del segundo en que corre.
                const now = dayjs().tz(RULE_TIMEZONE);
                expect(
                    RuleValidator.validate(rule, { ...context, hora_actual: now.format('HH:mm:ss') }, null, {
                        evaluationNow: now,
                    })
                ).toBe(true);
            });

            it('should validate LESS_THAN with current time', () => {
                const rule = Rule.fromValue({
                    field: 'hora_pasada',
                    value: 'time',
                    operator: RuleOperator.LESS_THAN,
                    type: 'function',
                    value_type: 'date',
                });

                expect(RuleValidator.validate(rule, context)).toBe(true);
            });
        });

        describe('DateTime Functions', () => {
            it('should validate NOT_EQUALS with current datetime', () => {
                const rule = Rule.fromValue({
                    field: 'datetime_pasado',
                    value: 'datetime',
                    operator: RuleOperator.NOT_EQUALS,
                    type: 'function',
                    value_type: 'date',
                });

                expect(RuleValidator.validate(rule, context)).toBe(true);
            });

            it('should validate GREATER_THAN with future datetime', () => {
                const rule = Rule.fromValue({
                    field: 'datetime_futuro',
                    value: 'datetime',
                    operator: RuleOperator.GREATER_THAN,
                    type: 'function',
                    value_type: 'date',
                });

                expect(RuleValidator.validate(rule, context)).toBe(true);
            });
        });

        describe('Edge Cases', () => {
            it('should throw error for invalid function type', () => {
                expect(() => {
                    Rule.fromValue({
                        field: 'fecha_actual',
                        value: 'INVALID_FUNCTION',
                        operator: RuleOperator.EQUALS,
                        type: 'function',
                        value_type: 'date',
                    });
                }).toThrow(ValidationFailError);
            });

            it('should return false when comparing different types', () => {
                const rule = Rule.fromValue({
                    field: 'hora_actual',
                    value: 'date',
                    operator: RuleOperator.EQUALS,
                    type: 'function',
                    value_type: 'date',
                });

                expect(RuleValidator.validate(rule, context)).toBe(false);
            });
        });

        describe('Composite Rules with Functions', () => {
            it('should validate AND combination with function and static value', () => {
                const compositeRule = CompositeRule.fromValue({
                    combinator: 'and',
                    rules: [
                        {
                            field: 'fecha_actual',
                            value: 'date',
                            operator: RuleOperator.EQUALS,
                            type: 'function',
                            value_type: 'date',
                        },
                        {
                            field: 'fecha_pasada',
                            value: '2020-01-01',
                            operator: RuleOperator.EQUALS,
                            type: 'manual_input',
                            value_type: 'date',
                        },
                    ],
                });

                expect(
                    RuleValidator.validate(compositeRule, { ...context, fecha_actual: dayjs().format('YYYY-MM-DD') })
                ).toBe(true);
            });
        });

        describe('aux_cases deeply nested date field with datetime function', () => {
            const AUX_FIELD = 'aux_cases.reclamaciones.gestion_reclamacion.fecha_y_hora_de_reprogramacion';

            const makeRule = () =>
                Rule.fromValue({
                    field: AUX_FIELD,
                    value: 'datetime',
                    operator: RuleOperator.LESS_THAN,
                    type: 'function',
                    value_type: 'date',
                });

            const makeCtx = (fechaValue) => ({
                aux_cases: {
                    reclamaciones: {
                        gestion_reclamacion: {
                            fecha_y_hora_de_reprogramacion: fechaValue,
                        },
                    },
                },
            });

            it('should return true when the aux_cases date field is in the past (action should execute)', () => {
                const pastDate = dayjs().subtract(1, 'day').toISOString();
                expect(RuleValidator.validate(makeRule(), makeCtx(pastDate))).toBe(true);
            });

            it('should return false when the aux_cases date field is in the future (action must NOT execute)', () => {
                const futureDate = dayjs().add(1, 'day').toISOString();
                expect(RuleValidator.validate(makeRule(), makeCtx(futureDate))).toBe(false);
            });

            it('should return false when the aux_cases date field is null', () => {
                expect(RuleValidator.validate(makeRule(), makeCtx(null))).toBe(false);
            });

            it('should return false when the aux_cases date field is absent (field not stored)', () => {
                const ctxWithoutField = { aux_cases: { reclamaciones: { gestion_reclamacion: {} } } };
                expect(RuleValidator.validate(makeRule(), ctxWithoutField)).toBe(false);
            });

            it('should return false when aux_cases data is empty (autocalculado field not persisted)', () => {
                expect(RuleValidator.validate(makeRule(), { aux_cases: {} })).toBe(false);
            });

            it('should return false when the date value is wrapped in an object instead of a plain string', () => {
                const wrappedValue = { value: dayjs().subtract(1, 'day').toISOString() };
                expect(RuleValidator.validate(makeRule(), makeCtx(wrappedValue))).toBe(false);
            });

            it('should return false when context has no aux_cases key at all', () => {
                expect(RuleValidator.validate(makeRule(), { cases: {}, clients: {} })).toBe(false);
            });

            describe('date format and timezone compatibility', () => {
                it('ISO 8601 with explicit Bogota offset (−05:00) past → true [RECOMMENDED]', () => {
                    const past = dayjs().subtract(1, 'day').format('YYYY-MM-DDTHH:mm:ss') + '-05:00';
                    expect(RuleValidator.validate(makeRule(), makeCtx(past))).toBe(true);
                });

                it('ISO 8601 with explicit Bogota offset (−05:00) future → false [RECOMMENDED]', () => {
                    const future = dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm:ss') + '-05:00';
                    expect(RuleValidator.validate(makeRule(), makeCtx(future))).toBe(false);
                });

                it('ISO 8601 UTC (Z) past → true', () => {
                    const past = dayjs().subtract(1, 'day').toISOString();
                    expect(RuleValidator.validate(makeRule(), makeCtx(past))).toBe(true);
                });

                it('ISO 8601 UTC (Z) future → false', () => {
                    const future = dayjs().add(1, 'day').toISOString();
                    expect(RuleValidator.validate(makeRule(), makeCtx(future))).toBe(false);
                });

                it('ISO without timezone past (1-day margin) → true', () => {
                    const past = dayjs().subtract(1, 'day').format('YYYY-MM-DDTHH:mm:ss');
                    expect(RuleValidator.validate(makeRule(), makeCtx(past))).toBe(true);
                });

                it('ISO without timezone future (1-day margin) → false', () => {
                    const future = dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm:ss');
                    expect(RuleValidator.validate(makeRule(), makeCtx(future))).toBe(false);
                });

                it('YYYY-MM-DD (date only) past → true', () => {
                    const past = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
                    expect(RuleValidator.validate(makeRule(), makeCtx(past))).toBe(true);
                });

                it('YYYY-MM-DD (date only) future → false', () => {
                    const future = dayjs().add(1, 'day').format('YYYY-MM-DD');
                    expect(RuleValidator.validate(makeRule(), makeCtx(future))).toBe(false);
                });

                it('YYYY-MM-DD HH:mm:ss past → true', () => {
                    const past = dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
                    expect(RuleValidator.validate(makeRule(), makeCtx(past))).toBe(true);
                });

                it('YYYY-MM-DD HH:mm:ss future → false', () => {
                    const future = dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
                    expect(RuleValidator.validate(makeRule(), makeCtx(future))).toBe(false);
                });

                it('DD/MM/YYYY HH:mm:ss past → true', () => {
                    const past = dayjs().subtract(1, 'day').format('DD/MM/YYYY HH:mm:ss');
                    expect(RuleValidator.validate(makeRule(), makeCtx(past))).toBe(true);
                });

                it('DD/MM/YYYY HH:mm:ss future → false', () => {
                    const future = dayjs().add(1, 'day').format('DD/MM/YYYY HH:mm:ss');
                    expect(RuleValidator.validate(makeRule(), makeCtx(future))).toBe(false);
                });
            });
        });
    });

    describe('clasificaciones.description alias (compares against classification ID)', () => {
        const CLASIFICACION_ID = 'dd918929-6257-42ff-a2d6-ced55ae945aa';

        const makeContext = (id) => ({
            clasificaciones: {
                id,
                nivel1: 'A',
                nivel2: 'B',
                description: 'A -> B',
            },
        });

        it('should resolve clasificaciones.description to the classification id in getFieldValue', () => {
            const result = RuleValidator.getFieldValue('clasificaciones.description', makeContext(CLASIFICACION_ID));
            expect(result).toBe(CLASIFICACION_ID);
        });

        it('should return true when an options_list rule value matches the classification id', () => {
            const rule = Rule.fromValue({
                field: 'clasificaciones.description',
                value: CLASIFICACION_ID,
                operator: RuleOperator.EQUALS,
                type: 'options_list',
                value_type: 'text',
            });

            expect(RuleValidator.validate(rule, makeContext(CLASIFICACION_ID))).toBe(true);
        });

        it('should return false when the classification id is different from the rule value', () => {
            const rule = Rule.fromValue({
                field: 'clasificaciones.description',
                value: CLASIFICACION_ID,
                operator: RuleOperator.EQUALS,
                type: 'options_list',
                value_type: 'text',
            });

            expect(RuleValidator.validate(rule, makeContext('11111111-2222-3333-4444-555555555555'))).toBe(false);
        });
    });
});
