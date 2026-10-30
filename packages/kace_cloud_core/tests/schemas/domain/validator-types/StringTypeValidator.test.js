import { VODataStructure } from '../../../../src/schemas/domain/VODataStructure.js';
import { UuidError } from '../../../../src/shared/index.js';

describe('StringTypeValidator - unit tests', () => {
    describe('scalar attribute types', () => {
        it.each(['empty', 'alphanum', 'isoDate', 'base64', 'dataUri', 'trim', 'lowercase', 'uppercase'])(
            'should reject %s when it is not a boolean',
            (key) => {
                const structure = { field: { type: 'string', required: true, [key]: 'yes' } };
                expect(() => new VODataStructure(structure)).toThrow(
                    new RegExp(`'field.${key}' is required and must be a boolean`)
                );
            }
        );

        it.each(['min', 'max', 'length'])('should reject %s when it is not a number', (key) => {
            const structure = { field: { type: 'string', required: true, [key]: 'not-a-number' } };
            expect(() => new VODataStructure(structure)).toThrow(
                new RegExp(`'field.${key}' is required and must be a number`)
            );
        });

        it.each(['ip', 'email', 'uri', 'pattern'])('should reject %s when it is not an object', (key) => {
            const structure = { field: { type: 'string', required: true, [key]: 'not-an-object' } };
            expect(() => new VODataStructure(structure)).toThrow(
                new RegExp(`'field.${key}' is required and must be an object`)
            );
        });

        it.each(['regexReplace', 'valid', 'invalid'])('should reject %s when it is not an array', (key) => {
            const structure = { field: { type: 'string', required: true, [key]: 'not-an-array' } };
            expect(() => new VODataStructure(structure)).toThrow(
                new RegExp(`'field.${key}' is required and must be an array`)
            );
        });

        it('should reject a non-string default', () => {
            const structure = { field: { type: 'string', required: true, default: 42 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.default' is required and must be a string/);
        });
    });

    describe('restflow_id', () => {
        it('should accept a well-formed restflow_id uuid', () => {
            const structure = {
                field: { type: 'string', required: true, restflow_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a malformed restflow_id', () => {
            const structure = { field: { type: 'string', required: true, restflow_id: 'not-a-uuid' } };
            expect(() => new VODataStructure(structure)).toThrow(UuidError);
        });
    });

    describe('min/max/length combinations', () => {
        it('should reject min greater than max', () => {
            const structure = { field: { type: 'string', required: true, min: 10, max: 5 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.min' \(10\) no puede ser mayor/);
        });

        it('should accept min lower than max', () => {
            const structure = { field: { type: 'string', required: true, min: 1, max: 5 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        // Frontera exacta de `config.min > config.max`: min === max es legitimo y debe aceptarse.
        it('should accept min exactly equal to max', () => {
            const structure = { field: { type: 'string', required: true, min: 5, max: 5 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject valid and invalid sharing a value', () => {
            const structure = { field: { type: 'string', required: true, valid: ['a', 'b'], invalid: ['b', 'c'] } };
            expect(() => new VODataStructure(structure)).toThrow(/no pueden tener valores en común: \[b\]/);
        });

        it('should accept disjoint valid and invalid arrays', () => {
            const structure = { field: { type: 'string', required: true, valid: ['a'], invalid: ['b'] } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject length combined with min', () => {
            const structure = { field: { type: 'string', required: true, length: 5, min: 2 } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede tener 'length' junto con 'min' o 'max'/);
        });

        it('should reject length combined with max', () => {
            const structure = { field: { type: 'string', required: true, length: 5, max: 2 } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede tener 'length' junto con 'min' o 'max'/);
        });

        it('should accept length used alone', () => {
            const structure = { field: { type: 'string', required: true, length: 5 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('default value', () => {
        it('should reject a default present in invalid', () => {
            const structure = { field: { type: 'string', required: true, invalid: ['x', 'z'], default: 'z' } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede estar en la lista de valores inválidos/);
        });

        it('should reject a default absent from valid', () => {
            const structure = { field: { type: 'string', required: true, valid: ['a', 'b'], default: 'z' } };
            expect(() => new VODataStructure(structure)).toThrow(/debe estar en la lista de valores válidos/);
        });

        it('should accept a default present in valid', () => {
            const structure = { field: { type: 'string', required: true, valid: ['a', 'b'], default: 'a' } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a default with the wrong length', () => {
            const structure = { field: { type: 'string', required: true, length: 4, default: 'abc' } };
            expect(() => new VODataStructure(structure)).toThrow(/debe tener longitud exactamente 4/);
        });

        it('should accept a default with the right length', () => {
            const structure = { field: { type: 'string', required: true, length: 3, default: 'abc' } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a default shorter than min', () => {
            const structure = { field: { type: 'string', required: true, min: 5, default: 'abc' } };
            expect(() => new VODataStructure(structure)).toThrow(/debe tener longitud mínima de 5/);
        });

        it('should accept a default longer than or equal to min', () => {
            const structure = { field: { type: 'string', required: true, min: 3, default: 'abc' } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a default longer than max', () => {
            const structure = { field: { type: 'string', required: true, max: 2, default: 'abcd' } };
            expect(() => new VODataStructure(structure)).toThrow(/debe tener longitud máxima de 2/);
        });

        it('should accept a default shorter than or equal to max', () => {
            // Frontera exacta de `def.length > config.max`: la longitud del default es EXACTAMENTE max.
            const structure = { field: { type: 'string', required: true, max: 4, default: 'abcd' } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a default that does not match the pattern', () => {
            const structure = { field: { type: 'string', required: true, pattern: /^[A-Z]+$/, default: 'abc' } };
            expect(() => new VODataStructure(structure)).toThrow(/no cumple con el patrón especificado/);
        });

        it('should accept a default that matches the pattern', () => {
            const structure = { field: { type: 'string', required: true, pattern: /^[A-Z]+$/, default: 'ABC' } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should ignore a non-RegExp pattern for default validation', () => {
            const structure = {
                field: { type: 'string', required: true, pattern: { source: 'not-a-regexp' }, default: 'abc' },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a non-alphanumeric default when alphanum:true', () => {
            const structure = { field: { type: 'string', required: true, alphanum: true, default: 'abc!' } };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser alfanumérico/);
        });

        it('should accept an alphanumeric default when alphanum:true', () => {
            const structure = { field: { type: 'string', required: true, alphanum: true, default: 'abc123' } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a non-lowercase default when lowercase:true', () => {
            const structure = { field: { type: 'string', required: true, lowercase: true, default: 'ABC' } };
            expect(() => new VODataStructure(structure)).toThrow(/debe estar en minúsculas/);
        });

        it('should accept a lowercase default when lowercase:true', () => {
            const structure = { field: { type: 'string', required: true, lowercase: true, default: 'abc' } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a non-uppercase default when uppercase:true', () => {
            const structure = { field: { type: 'string', required: true, uppercase: true, default: 'abc' } };
            expect(() => new VODataStructure(structure)).toThrow(/debe estar en mayúsculas/);
        });

        it('should accept an uppercase default when uppercase:true', () => {
            const structure = { field: { type: 'string', required: true, uppercase: true, default: 'ABC' } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('ui block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject ui when it is %s', (_label, ui) => {
            const structure = { field: { type: 'string', required: true, ui } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui' debe ser un objeto/);
        });

        it('should reject a non-boolean ui.show_in_grid', () => {
            const structure = { field: { type: 'string', required: true, ui: { show_in_grid: 'yes' } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.show_in_grid' debe ser booleano/);
        });

        it('should reject ui.label when it is not a string', () => {
            const structure = { field: { type: 'string', required: true, ui: { label: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.label' debe ser string/);
        });

        it('should reject ui.css when it is not a string', () => {
            const structure = { field: { type: 'string', required: true, ui: { css: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.css' debe ser string/);
        });

        it('should reject an invalid ui.input_type', () => {
            const structure = { field: { type: 'string', required: true, ui: { input_type: 'slider' } } };
            expect(() => new VODataStructure(structure)).toThrow(/tiene un valor inválido/);
        });

        it('should accept a fully populated valid ui object', () => {
            const structure = {
                field: {
                    type: 'string',
                    required: true,
                    ui: {
                        label: 'Nombre',
                        css: 'w-full',
                        input_type: 'text',
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
            const structure = { field: { type: 'string', required: true, ui: { read_only: value } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.read_only' debe ser booleano/);
        });
    });

    describe('sources block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject sources when it is %s', (_label, sources) => {
            const structure = { field: { type: 'string', required: true, sources } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.sources' debe ser un objeto/);
        });

        it('should reject sources with an unsupported key', () => {
            const structure = { field: { type: 'string', required: true, sources: { unknown_source: 'x' } } };
            expect(() => new VODataStructure(structure)).toThrow(/contiene la clave no permitida 'unknown_source'/);
        });

        it('should reject a sources URL that is not http(s)', () => {
            const structure = {
                field: { type: 'string', required: true, sources: { entities_source: 'ftp://x.com' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser una URL válida/);
        });

        it('should accept a non-string source value without validating it as a URL', () => {
            const structure = { field: { type: 'string', required: true, sources: { entities_source: 123 } } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should accept a valid http(s) source URL', () => {
            const structure = {
                field: { type: 'string', required: true, sources: { restflow_source: 'https://x.com/y' } },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });
});
