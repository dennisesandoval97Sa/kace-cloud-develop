import { VODataStructure } from '../../../../src/schemas/domain/VODataStructure.js';
import { UuidError } from '../../../../src/shared/index.js';
import { v4 as uuidv4 } from 'uuid';

describe('ArrayTypeValidator - unit tests', () => {
    // NOTE: al igual que en ObjectTypeValidator, las comprobaciones de `config.type !== 'array'`
    // (línea 10) y `typeof config.required !== 'boolean'` (línea 14) son inalcanzables desde la
    // API pública: VODataStructure ya garantiza ambas condiciones antes de despachar al
    // validador de tipo. Documentado en vez de forzarlas con una llamada directa al validador.

    describe('schema_id', () => {
        it('should accept a well-formed schema_id uuid', () => {
            const structure = { field: { type: 'array', required: true, schema_id: uuidv4() } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a malformed schema_id', () => {
            const structure = { field: { type: 'array', required: true, schema_id: 'not-a-uuid' } };
            expect(() => new VODataStructure(structure)).toThrow(UuidError);
        });

        it('should accept a null schema_id without instantiating the uuid validator', () => {
            const structure = { field: { type: 'array', required: true, schema_id: null } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('data_structure', () => {
        it('should reject a non-object data_structure', () => {
            const structure = { field: { type: 'array', required: true, data_structure: 'not-an-object' } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.data_structure' debe ser un objeto/);
        });

        it('should accept an object data_structure', () => {
            const structure = {
                field: { type: 'array', required: true, data_structure: { nested: { type: 'string' } } },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('ui block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject ui when it is %s', (_label, ui) => {
            const structure = { field: { type: 'array', required: true, ui } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui' debe ser un objeto/);
        });

        it('should reject ui with an unsupported key', () => {
            const structure = { field: { type: 'array', required: true, ui: { unknownKey: 1 } } };
            expect(() => new VODataStructure(structure)).toThrow(/contiene la clave no permitida 'unknownKey'/);
        });

        it('should reject ui.label when it is not a string', () => {
            const structure = { field: { type: 'array', required: true, ui: { label: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.label' debe ser string/);
        });

        it('should reject ui.css when it is not a string', () => {
            const structure = { field: { type: 'array', required: true, ui: { css: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.css' debe ser string/);
        });

        it('should reject an invalid ui.input_type', () => {
            const structure = { field: { type: 'array', required: true, ui: { input_type: 'slider' } } };
            expect(() => new VODataStructure(structure)).toThrow(/tiene un valor inválido/);
        });

        it('should reject a non-boolean ui.show_in_grid', () => {
            const structure = { field: { type: 'array', required: true, ui: { show_in_grid: 'yes' } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.show_in_grid' debe ser booleano/);
        });

        it('should accept a fully populated valid ui object', () => {
            const structure = {
                field: {
                    type: 'array',
                    required: true,
                    ui: {
                        label: 'Contactos',
                        css: 'block',
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
            const structure = { field: { type: 'array', required: true, ui: { read_only: value } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.read_only' debe ser booleano/);
        });
    });

    describe('sources block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject sources when it is %s', (_label, sources) => {
            const structure = { field: { type: 'array', required: true, sources } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.sources' debe ser un objeto/);
        });

        it('should reject sources with an unsupported key', () => {
            const structure = { field: { type: 'array', required: true, sources: { unknown_source: 'x' } } };
            expect(() => new VODataStructure(structure)).toThrow(/contiene la clave no permitida 'unknown_source'/);
        });

        it('should reject a sources URL that is not http(s)', () => {
            const structure = {
                field: { type: 'array', required: true, sources: { entities_source: 'ftp://x.com' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser una URL válida/);
        });

        it('should accept a non-string source value without validating it as a URL', () => {
            const structure = { field: { type: 'array', required: true, sources: { entities_source: 123 } } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should accept a valid http(s) source URL', () => {
            const structure = {
                field: { type: 'array', required: true, sources: { restflow_source: 'https://x.com/y' } },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });
});
