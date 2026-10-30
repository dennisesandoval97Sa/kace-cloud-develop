import { VODataStructure } from '../../../src/schemas/domain/VODataStructure.js';
import { ValidationFailError } from '../../../src/shared/index.js';

describe('VODataStructure - field-config and dependency branches', () => {
    describe('field config shape', () => {
        it('should reject a config that is a string instead of an object', () => {
            const structure = { field: 'not-a-config' };
            expect(() => new VODataStructure(structure)).toThrow(/must be a configuration object/);
        });

        it('should reject a config that is null', () => {
            const structure = { field: null };
            expect(() => new VODataStructure(structure)).toThrow(/must be a configuration object/);
        });
    });

    describe('dependency attribute', () => {
        it('should reject a non-boolean dependency value', () => {
            const structure = { field: { type: 'string', required: true, dependency: 'yes' } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.dependency' must be a boolean/);
        });

        it('should reject a non-boolean dependencyValueValidation value', () => {
            const structure = {
                field: { type: 'string', required: true, dependencyValueValidation: 'yes' },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.dependencyValueValidation' must be a boolean/);
        });

        it('should reject dependencyValueValidation:true when dependency is not true', () => {
            const structure = {
                field: { type: 'string', required: true, dependencyValueValidation: true, dependencyValue: 'x' },
            };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.dependencyValueValidation' requires 'dependency' to be true/
            );
        });

        it.each([
            ['missing', undefined],
            ['not a string', 42],
            ['blank', '   '],
        ])('should reject dependencyValueValidation:true when dependencyValue is %s', (_label, dependencyValue) => {
            const structure = {
                other: { type: 'string', required: true },
                field: {
                    type: 'string',
                    required: true,
                    dependency: true,
                    dependsOn: 'other',
                    dependencyValueValidation: true,
                    dependencyValue,
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.dependencyValue' must be a non-empty string when 'dependencyValueValidation' is true/
            );
        });

        it('should accept dependencyValueValidation:true with a valid non-empty dependencyValue', () => {
            const structure = {
                other: { type: 'string', required: true },
                field: {
                    type: 'string',
                    required: true,
                    dependency: true,
                    dependsOn: 'other',
                    dependencyValueValidation: true,
                    dependencyValue: 'active',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject dependency:true without dependsOn', () => {
            const structure = { field: { type: 'string', required: true, dependency: true } };
            expect(() => new VODataStructure(structure)).toThrow(
                /has 'dependency' set to true but 'dependsOn' is missing/
            );
        });

        it('should reject a non-string dependsOn when dependency:true', () => {
            const structure = { field: { type: 'string', required: true, dependency: true, dependsOn: 42 } };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.dependsOn' must be a string referencing another field/
            );
        });

        it('should reject dependsOn referencing itself', () => {
            const structure = { field: { type: 'string', required: true, dependency: true, dependsOn: 'field' } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.dependsOn' cannot reference itself/);
        });

        it('should reject dependsOn referencing an unknown field', () => {
            const structure = { field: { type: 'string', required: true, dependency: true, dependsOn: 'ghost' } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.dependsOn' references unknown field 'ghost'/);
        });

        it('should accept dependency:true with a valid dependsOn reference', () => {
            const structure = {
                other: { type: 'string', required: true },
                field: { type: 'string', required: true, dependency: true, dependsOn: 'other' },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a non-string dependsOn when dependency is not true', () => {
            const structure = { field: { type: 'string', required: true, dependsOn: 42 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.dependsOn' must be a string/);
        });

        it('should accept a string dependsOn without dependency:true (informational reference)', () => {
            const structure = {
                other: { type: 'string', required: true },
                field: { type: 'string', required: true, dependsOn: 'other' },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should accept an absent dependsOn without dependency', () => {
            const structure = { field: { type: 'string', required: true } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should accept dependsOn explicitly set to an empty string without dependency', () => {
            const structure = { field: { type: 'string', required: true, dependsOn: '' } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        // La guarda de produccion es `dependsOn !== undefined && dependsOn !== null && dependsOn !== ''`.
        // El caso `''` no discrimina nada (dentro del bloque solo se comprueba `typeof !== 'string'` y
        // `''` ES un string), pero `null` si: sin la mitad `!== null` de la guarda entraria al bloque
        // y lanzaria 'must be a string'.
        it('should accept dependsOn explicitly set to null without dependency', () => {
            const structure = { field: { type: 'string', required: true, dependsOn: null } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });
});
