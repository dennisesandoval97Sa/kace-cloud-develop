import { RuleType } from '../../src/actions/domain/QueryTranslator/RuleType.js';
import { RuleValue } from '../../src/actions/domain/QueryTranslator/RuleValue.js';
import { RuleValueCalculator } from '../../src/actions/domain/QueryTranslator/RuleValueCalculator.js';

describe('RuleValueCalculator', () => {
    describe('calculate', () => {
        it('should calculate value for type "function" - date', () => {
            const result = RuleValueCalculator.calculate(new RuleValue('date', 'function'), RuleType.FUNCTION);

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should calculate value for type "function" - time', () => {
            const result = RuleValueCalculator.calculate(new RuleValue('time', 'function'), RuleType.FUNCTION);

            expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        });

        it('should calculate value for type "function" - datetime', () => {
            const result = RuleValueCalculator.calculate(new RuleValue('datetime', 'function'), RuleType.FUNCTION);

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
        });

        it('should throw error for unsupported function type', () => {
            expect(() => {
                RuleValueCalculator.calculate(new RuleValue('unknown'), RuleType.FUNCTION);
            }).toThrow('Unsupported function type: unknown');
        });

        it('should calculate value for type "entity"', () => {
            const context = { estados: { id: '' } };
            const result = RuleValueCalculator.calculate(new RuleValue('cases.estadoActual'), RuleType.ENTITY, context);

            expect(result).toBe(context.estados.id);
        });

        it('should calculate value for type "entity" with generic path', () => {
            const context = { usuario: { nombre: 'Test' } };

            const result = RuleValueCalculator.calculate(new RuleValue('usuario.nombre'), RuleType.ENTITY, context);

            expect(result).toBe(context.usuario.nombre);
        });

        it('should return direct value if ruleType is not function or entity', () => {
            const result = RuleValueCalculator.calculate(new RuleValue('just-a-value'), RuleType.MANUAL_INPUT);

            expect(result).toBe('just-a-value');
        });

        it('should return undefined for entity when path does not exist in context', () => {
            const context = {};

            const result = RuleValueCalculator.calculate(new RuleValue('usuario.nombre'), RuleType.ENTITY, context);

            expect(result).toBeUndefined();
        });
    });
});
