import { FormulaFunctionsValidator } from '../../../src/schemas/domain/FormulaFunctionsValidator.js';
import { ValidationFailError } from '../../../src/shared/index.js';

describe('FormulaFunctionsValidator - unit tests', () => {
    describe('validate', () => {
        it('should reject a non-string formula', () => {
            expect(() => FormulaFunctionsValidator.validate(42, {})).toThrow(ValidationFailError);
            expect(() => FormulaFunctionsValidator.validate(42, {})).toThrow('calc.formula must be a string');
        });

        it('should reject a formula that calls an unknown function', () => {
            expect(() => FormulaFunctionsValidator.validate('unknownFn(1)', {})).toThrow(
                'Invalid function "unknownFn" in formula'
            );
        });

        it('should accept a formula that only calls known functions', () => {
            expect(() => FormulaFunctionsValidator.validate('sum(1,2)', {})).not.toThrow();
        });

        it('should reject a ref() to a field absent from the data structure', () => {
            const dataStructure = { known: { type: 'number' } };
            expect(() => FormulaFunctionsValidator.validate('sum(ref("missing"))', dataStructure)).toThrow(
                'Invalid field reference "missing" in formula'
            );
        });

        it('should accept a ref() to a field present in the data structure', () => {
            const dataStructure = { known: { type: 'number' } };
            expect(() => FormulaFunctionsValidator.validate('sum(ref("known"),1)', dataStructure)).not.toThrow();
        });

        it('should unwrap a value-object-like dataStructure (dataStructure.value)', () => {
            const dataStructure = { value: { known: { type: 'number' } } };
            expect(() => FormulaFunctionsValidator.validate('sum(ref("known"),1)', dataStructure)).not.toThrow();
        });

        it('should accept a formula with neither function calls nor ref() usages', () => {
            expect(() => FormulaFunctionsValidator.validate('42', {})).not.toThrow();
        });
    });

    describe('validateParams', () => {
        it('should reject an unknown function name', () => {
            expect(() => FormulaFunctionsValidator.validateParams('notAFunction', [])).toThrow(
                'Function "notAFunction" not found'
            );
        });

        it('should reject a call with the wrong number of arguments for a non-variadic function', () => {
            // addDays(date, n) espera exactamente 2 argumentos y no es variádica.
            expect(() => FormulaFunctionsValidator.validateParams('addDays', [1])).toThrow(
                'Function "addDays" expects 2 arguments but got 1'
            );
        });

        it('should accept a call with the exact number of arguments for a non-variadic function', () => {
            expect(() => FormulaFunctionsValidator.validateParams('addDays', [1, 2])).not.toThrow();
        });

        it('should accept a variadic function call regardless of argument count', () => {
            // sum() está declarada como variádica: cualquier cantidad de argumentos es válida.
            expect(() => FormulaFunctionsValidator.validateParams('sum', [1, 2, 3, 4])).not.toThrow();
        });

        // sum() tiene UN unico parametro y es variadico, asi que no distingue `.some(variadic)` de
        // `.every(variadic)`. concat() es MIXTA (un 'cond' fijo + un 'values' variadico): solo la
        // semantica correcta (`some`) permite pasarle mas argumentos que parametros declarados.
        it('should accept a mixed variadic function call with more arguments than declared params', () => {
            expect(() => FormulaFunctionsValidator.validateParams('concat', [true, 'a', 'b', 'c'])).not.toThrow();
        });

        it.each(['and', 'or', 'not'])(
            'should accept the mixed variadic function %s with more arguments than declared params',
            (name) => {
                expect(() => FormulaFunctionsValidator.validateParams(name, [true, 1, 2, 3])).not.toThrow();
            }
        );
    });
});
