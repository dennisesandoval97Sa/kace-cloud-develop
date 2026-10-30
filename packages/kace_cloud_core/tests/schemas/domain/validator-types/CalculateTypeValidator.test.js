import { VODataStructure } from '../../../../src/schemas/domain/VODataStructure.js';
import { ValidationFailError } from '../../../../src/shared/index.js';

describe('CalculateTypeValidator - unit tests', () => {
    const baseCalc = { formula: 'sum(1,2)', on: ['create'], error_policy: 'error' };

    // BUG DE PRODUCCIÓN (documentado, no corregido en esta tarea):
    // CalculateTypeValidator.validate llama `FormulaFunctionsValidator.validate(config.calc.formula, ...)`
    // (CalculateTypeValidator.js:69) ANTES de comprobar `!config.calc || typeof config.calc !== 'object'`
    // (línea 78, con el mensaje pensado `'{field}' must include a 'calc' object.`). Si el campo 'calc'
    // falta por completo, `config.calc.formula` lanza un TypeError crudo ("Cannot read properties of
    // undefined (reading 'formula')") en lugar del ValidationFailError con mensaje amigable que la
    // línea 78 pretende dar. El chequeo de la línea 78 queda, en la práctica, inalcanzable: para
    // llegar hasta allí sin que la línea 69 ya explote, `config.calc` tiene que ser truthy (o un
    // primitivo con `.formula` en string, lo que hace que `FormulaFunctionsValidator.validate` no
    // lance), momento en el cual `!config.calc` ya es `false`. No se fuerza esta rama con un rodeo
    // (p.ej. asignar una función con una propiedad `.formula` colgada) porque no representa un uso
    // real de la API pública (los data_structure son JSON, nunca contienen funciones).
    it('should throw a raw TypeError (not ValidationFailError) when calc is missing entirely', () => {
        const structure = { field: { type: 'calculated', required: true } };
        expect(() => new VODataStructure(structure)).toThrow(TypeError);
        try {
            new VODataStructure(structure);
            throw new Error('expected constructor to throw');
        } catch (e) {
            expect(e).not.toBeInstanceOf(ValidationFailError);
            expect(e.message).toMatch(/Cannot read propert(y|ies) of undefined/);
        }
    });

    describe('formula validation', () => {
        it('should reject a formula referencing an unknown function', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: { ...baseCalc, formula: 'invalid(1,2)' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/Invalid function "invalid" in formula/);
        });

        it('should reject a formula referencing an unknown field', () => {
            const structure = {
                other: { type: 'number', required: true },
                field: { type: 'calculated', required: true, calc: { ...baseCalc, formula: 'sum(ref("nope"))' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/Invalid field reference "nope" in formula/);
        });

        it('should accept a formula referencing a known field', () => {
            const structure = {
                other: { type: 'number', required: true },
                field: { type: 'calculated', required: true, calc: { ...baseCalc, formula: 'sum(ref("other"),1)' } },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('calc.formula / calc.on / calc.error_policy', () => {
        it('should reject a non-string calc.formula (caught earlier by FormulaFunctionsValidator)', () => {
            // Este caso nunca llega a la comprobación propia de CalculateTypeValidator
            // (línea 82: "must include a valid 'calc.formula' string"): FormulaFunctionsValidator.validate
            // se invoca antes (línea 69) y ya rechaza cualquier `formula` no-string con su propio mensaje.
            const structure = { field: { type: 'calculated', required: true, calc: { ...baseCalc, formula: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow('calc.formula must be a string');
        });

        it("should reject calc.formula as an empty string (CalculateTypeValidator's own check)", () => {
            // A diferencia del caso anterior, '' es typeof 'string', así que
            // FormulaFunctionsValidator.validate no lanza (no matchea funciones ni refs en una cadena
            // vacía). Solo entonces se alcanza la comprobación propia `!config.calc.formula` de
            // CalculateTypeValidator (línea 82), que sí rechaza la cadena vacía por ser falsy.
            const structure = { field: { type: 'calculated', required: true, calc: { ...baseCalc, formula: '' } } };
            expect(() => new VODataStructure(structure)).toThrow("'field' must include a valid 'calc.formula' string.");
        });

        it('should reject an empty calc.on array', () => {
            const structure = { field: { type: 'calculated', required: true, calc: { ...baseCalc, on: [] } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.calc.on' must be a non-empty array/);
        });

        it('should reject a non-array calc.on', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: { ...baseCalc, on: 'create' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.calc.on' must be a non-empty array/);
        });

        it('should reject a missing calc.error_policy', () => {
            const structure = {
                field: {
                    type: 'calculated',
                    required: true,
                    calc: { formula: baseCalc.formula, on: baseCalc.on },
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.calc.error_policy' must be one of: error, empty/
            );
        });

        it('should reject an invalid calc.error_policy', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: { ...baseCalc, error_policy: 'ignore' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.calc.error_policy' must be one of: error, empty/
            );
        });

        it('should accept error_policy "empty"', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: { ...baseCalc, error_policy: 'empty' } },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a calc.on value outside create/update', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: { ...baseCalc, on: ['delete'] } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/calc.on' contiene valor inválido: delete/);
        });

        it('should accept calc.on with both create and update', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: { ...baseCalc, on: ['create', 'update'] } },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('unsupported keys', () => {
        it('should reject an unsupported top-level key', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: baseCalc, trim: true },
            };
            expect(() => new VODataStructure(structure)).toThrow(/unsupported key/);
        });
    });

    describe('ui block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject ui when it is %s', (_label, ui) => {
            const structure = { field: { type: 'calculated', required: true, calc: baseCalc, ui } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui' debe ser un objeto/);
        });

        it('should reject ui with an unsupported key', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: baseCalc, ui: { unknownKey: 1 } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/contiene la clave no permitida 'unknownKey'/);
        });

        it('should reject ui.label when it is not a string', () => {
            const structure = { field: { type: 'calculated', required: true, calc: baseCalc, ui: { label: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.label' debe ser string/);
        });

        it('should reject ui.css when it is not a string', () => {
            const structure = { field: { type: 'calculated', required: true, calc: baseCalc, ui: { css: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.css' debe ser string/);
        });

        it('should reject a non-boolean ui.read_only', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: baseCalc, ui: { read_only: 'yes' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.read_only' debe ser booleano/);
        });

        it('should accept a fully populated valid ui object', () => {
            const structure = {
                field: {
                    type: 'calculated',
                    required: true,
                    calc: baseCalc,
                    ui: {
                        label: 'Total',
                        css: 'text-right',
                        input_type: 'number',
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
            const structure = {
                field: { type: 'calculated', required: true, calc: baseCalc, ui: { read_only: value } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.read_only' debe ser booleano/);
        });
    });

    describe('sources block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject sources when it is %s', (_label, sources) => {
            const structure = { field: { type: 'calculated', required: true, calc: baseCalc, sources } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.sources' debe ser un objeto/);
        });

        it('should reject sources with an unsupported key', () => {
            const structure = {
                field: { type: 'calculated', required: true, calc: baseCalc, sources: { unknown_source: 'x' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/contiene la clave no permitida 'unknown_source'/);
        });

        it('should reject a sources URL that is not http(s)', () => {
            const structure = {
                field: {
                    type: 'calculated',
                    required: true,
                    calc: baseCalc,
                    sources: { entities_source: 'ftp://x.com' },
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser una URL válida/);
        });

        it('should accept a valid http(s) source URL', () => {
            const structure = {
                field: {
                    type: 'calculated',
                    required: true,
                    calc: baseCalc,
                    sources: { restflow_source: 'https://x.com/y' },
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });
});
