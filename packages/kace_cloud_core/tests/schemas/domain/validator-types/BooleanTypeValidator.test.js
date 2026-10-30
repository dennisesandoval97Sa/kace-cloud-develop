import { VODataStructure } from '../../../../src/schemas/domain/VODataStructure.js';
import { ValidationFailError, UuidError } from '../../../../src/shared/index.js';

describe('BooleanTypeValidator - unit tests', () => {
    // NOTE (bug de producción, no corregido en esta tarea): BooleanTypeValidator.validate
    // re-valida 'required' con `config.hasOwnProperty('required') && typeof config.required !== 'boolean'`
    // (BooleanTypeValidator.js:11), pero VODataStructure.validateStructure ya exige que
    // `required` sea booleano ANTES de invocar al validador de tipo (VODataStructure.js:52).
    // Por lo tanto la rama verdadera de esa condición es inalcanzable desde la API pública:
    // cualquier `required` no-booleano ya hizo throw en VODataStructure. Se documenta en vez
    // de fabricar un rodeo (p.ej. llamar al validador directamente) para forzarla.

    describe('truthyValues / falsyValues type and content', () => {
        it('should reject truthyValues when it is not an array', () => {
            const structure = { field: { type: 'boolean', required: true, truthyValues: 'yes' } };
            expect(() => new VODataStructure(structure)).toThrow(ValidationFailError);
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.truthyValues' is required and must be an array/
            );
        });

        it('should reject falsyValues when it is not an array', () => {
            const structure = { field: { type: 'boolean', required: true, falsyValues: 'no' } };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.falsyValues' is required and must be an array/
            );
        });

        it('should reject an empty truthyValues array', () => {
            const structure = { field: { type: 'boolean', required: true, truthyValues: [] } };
            expect(() => new VODataStructure(structure)).toThrow(/truthyValues' no puede ser un array vacío/);
        });

        it('should reject an empty falsyValues array', () => {
            const structure = { field: { type: 'boolean', required: true, falsyValues: [] } };
            expect(() => new VODataStructure(structure)).toThrow(/falsyValues' no puede ser un array vacío/);
        });

        it.each([
            ['empty string', ''],
            ['null', null],
        ])('should reject truthyValues containing %s', (_label, badValue) => {
            const structure = { field: { type: 'boolean', required: true, truthyValues: ['yes', badValue] } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede contener valores vacíos, null o undefined/);
        });

        it('should reject truthyValues containing a non-string/non-number value', () => {
            const structure = { field: { type: 'boolean', required: true, truthyValues: ['yes', true] } };
            expect(() => new VODataStructure(structure)).toThrow(/solo puede contener strings o números/);
        });

        it('should reject truthyValues containing duplicated values', () => {
            const structure = { field: { type: 'boolean', required: true, truthyValues: ['yes', 'yes'] } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede contener valores duplicados/);
        });

        it('should reject when truthyValues and falsyValues share a value', () => {
            const structure = {
                field: { type: 'boolean', required: true, truthyValues: ['ok'], falsyValues: ['ok'] },
            };
            expect(() => new VODataStructure(structure)).toThrow(/no pueden tener valores en común: \[ok\]/);
        });

        it('should accept disjoint truthyValues and falsyValues made of numbers', () => {
            const structure = {
                field: { type: 'boolean', required: true, truthyValues: [1, 2], falsyValues: [0, -1] },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('restflow_id', () => {
        it('should accept a well-formed restflow_id uuid', () => {
            const structure = {
                field: { type: 'boolean', required: true, restflow_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a malformed restflow_id', () => {
            const structure = { field: { type: 'boolean', required: true, restflow_id: 'not-a-uuid' } };
            expect(() => new VODataStructure(structure)).toThrow(UuidError);
            expect(() => new VODataStructure(structure)).toThrow(/restflow_id: Invalid value not-a-uuid/);
        });

        it('should accept a null restflow_id without instantiating the uuid validator', () => {
            const structure = { field: { type: 'boolean', required: true, restflow_id: null } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('default value', () => {
        it('should accept a boolean default', () => {
            const structure = { field: { type: 'boolean', required: true, default: true } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should accept a non-boolean default present in truthyValues', () => {
            const structure = {
                field: { type: 'boolean', required: true, truthyValues: ['yes', 'ok'], default: 'yes' },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should accept a non-boolean default present in falsyValues', () => {
            const structure = {
                field: { type: 'boolean', required: true, falsyValues: ['no', 'fail'], default: 'fail' },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a non-boolean default absent from both truthyValues and falsyValues', () => {
            const structure = {
                field: {
                    type: 'boolean',
                    required: true,
                    truthyValues: ['yes'],
                    falsyValues: ['no'],
                    default: 'maybe',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(
                /debe ser booleano o estar en truthyValues o falsyValues/
            );
        });
    });

    describe('ui block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject ui when it is %s', (_label, ui) => {
            const structure = { field: { type: 'boolean', required: true, ui } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui' debe ser un objeto/);
        });

        it('should reject ui with an unsupported key', () => {
            const structure = { field: { type: 'boolean', required: true, ui: { unknownKey: 1 } } };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.ui' contiene la clave no permitida 'unknownKey'/
            );
        });

        it('should reject ui.label when it is not a string', () => {
            const structure = { field: { type: 'boolean', required: true, ui: { label: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.label' debe ser string/);
        });

        it('should reject ui.css when it is not a string', () => {
            const structure = { field: { type: 'boolean', required: true, ui: { css: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.css' debe ser string/);
        });

        it('should reject an invalid ui.input_type', () => {
            const structure = { field: { type: 'boolean', required: true, ui: { input_type: 'slider' } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.input_type' tiene un valor inválido/);
        });

        it('should reject a non-boolean ui.show_in_grid', () => {
            const structure = { field: { type: 'boolean', required: true, ui: { show_in_grid: 'yes' } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.show_in_grid' debe ser booleano/);
        });

        it('should accept a fully populated valid ui object', () => {
            const structure = {
                field: {
                    type: 'boolean',
                    required: true,
                    ui: {
                        label: 'Activo',
                        css: 'text-bold',
                        input_type: 'checkbox',
                        show_in_grid: true,
                        read_only: false,
                        is_visible: true,
                        ui_modified: false,
                    },
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        // La guarda de produccion es `config.ui.hasOwnProperty(boolKey) && typeof ... !== 'boolean'`.
        // Un valor falsy NO booleano distingue "la clave existe" de "la clave es verdadera": si la
        // guarda degenerase a `config.ui[boolKey]`, un 0 o un null pasarian en silencio.
        it.each([
            ['0', 0],
            ['null', null],
            ['an empty string', ''],
        ])('should reject a falsy non-boolean ui.read_only (%s)', (_label, value) => {
            const structure = { field: { type: 'boolean', required: true, ui: { read_only: value } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.read_only' debe ser booleano/);
        });
    });

    describe('sources block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject sources when it is %s', (_label, sources) => {
            const structure = { field: { type: 'boolean', required: true, sources } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.sources' debe ser un objeto/);
        });

        it('should reject sources with an unsupported key', () => {
            const structure = { field: { type: 'boolean', required: true, sources: { unknown_source: 'x' } } };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.sources' contiene la clave no permitida 'unknown_source'/
            );
        });

        it('should reject a sources URL that is not http(s)', () => {
            const structure = {
                field: { type: 'boolean', required: true, sources: { literals_source: 'ftp://x.com' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.sources.literals_source' debe ser una URL válida/
            );
        });

        it('should accept a non-string source value without validating it as a URL', () => {
            const structure = {
                field: { type: 'boolean', required: true, sources: { literals_source: 123 } },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should accept a valid http(s) source URL', () => {
            const structure = {
                field: { type: 'boolean', required: true, sources: { auxiliaries_source: 'https://x.com/y' } },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });
});
