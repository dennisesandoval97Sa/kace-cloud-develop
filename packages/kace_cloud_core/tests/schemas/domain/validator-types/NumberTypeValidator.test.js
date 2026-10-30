import { VODataStructure } from '../../../../src/schemas/domain/VODataStructure.js';
import { ValidationFailError, UuidError } from '../../../../src/shared/index.js';

describe('NumberTypeValidator - unit tests', () => {
    describe('unsupported keys', () => {
        it('should reject an unsupported top-level key', () => {
            const structure = { field: { type: 'number', required: true, trim: true } };
            expect(() => new VODataStructure(structure)).toThrow(
                /\[NumberTypeValidator\] 'field' contains unsupported key\(s\): trim/
            );
        });
    });

    describe('scalar attribute types', () => {
        it('should reject integer when it is not a boolean', () => {
            const structure = { field: { type: 'number', required: true, integer: 'yes' } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.integer' is required and must be a boolean/);
        });

        it.each(['min', 'max', 'greater', 'less', 'precision', 'multiple', 'default'])(
            'should reject %s when it is not a number',
            (key) => {
                const structure = { field: { type: 'number', required: true, [key]: 'not-a-number' } };
                expect(() => new VODataStructure(structure)).toThrow(
                    new RegExp(`'field.${key}' is required and must be a number`)
                );
            }
        );

        it.each(['positive', 'negative', 'unsafe', 'port'])('should reject %s when it is not a boolean', (key) => {
            const structure = { field: { type: 'number', required: true, [key]: 'yes' } };
            expect(() => new VODataStructure(structure)).toThrow(
                new RegExp(`'field.${key}' is required and must be a boolean`)
            );
        });

        it('should reject valid when it is not an array', () => {
            const structure = { field: { type: 'number', required: true, valid: 5 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.valid' is required and must be an array/);
        });

        it('should reject invalid when it is not an array', () => {
            const structure = { field: { type: 'number', required: true, invalid: 5 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.invalid' is required and must be an array/);
        });
    });

    describe('restflow_id', () => {
        it('should accept a well-formed restflow_id uuid', () => {
            const structure = {
                field: { type: 'number', required: true, restflow_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a malformed restflow_id', () => {
            const structure = { field: { type: 'number', required: true, restflow_id: 'not-a-uuid' } };
            expect(() => new VODataStructure(structure)).toThrow(UuidError);
        });
    });

    describe('positive/negative combination', () => {
        it('should reject positive:false and negative:false together', () => {
            const structure = { field: { type: 'number', required: true, positive: false, negative: false } };
            expect(() => new VODataStructure(structure)).toThrow(
                /no puede tener 'positive' y 'negative' ambos en false/
            );
        });

        it('should accept positive:true and negative:false together', () => {
            const structure = { field: { type: 'number', required: true, positive: true, negative: false } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('valid/invalid overlap', () => {
        it('should reject when valid and invalid share a value', () => {
            const structure = { field: { type: 'number', required: true, valid: [1, 2], invalid: [2, 3] } };
            expect(() => new VODataStructure(structure)).toThrow(/no pueden tener valores en común: \[2\]/);
        });

        it('should accept disjoint valid and invalid arrays', () => {
            const structure = { field: { type: 'number', required: true, valid: [1, 2], invalid: [3, 4] } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('range combinations', () => {
        it('should reject min greater than max', () => {
            const structure = { field: { type: 'number', required: true, min: 10, max: 5 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.min' \(10\) no puede ser mayor/);
        });

        it('should accept min lower than max', () => {
            const structure = { field: { type: 'number', required: true, min: 1, max: 5 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        // Frontera exacta de `config.min > config.max`: min === max es legitimo y debe aceptarse.
        it('should accept min exactly equal to max', () => {
            const structure = { field: { type: 'number', required: true, min: 5, max: 5 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject greater equal to less', () => {
            const structure = { field: { type: 'number', required: true, greater: 10, less: 10 } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede ser mayor o igual que/);
        });

        it('should accept greater strictly lower than less', () => {
            const structure = { field: { type: 'number', required: true, greater: 1, less: 5 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject min and greater defined together', () => {
            const structure = { field: { type: 'number', required: true, min: 5, greater: 2 } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede tener 'min' y 'greater'/);
        });

        it('should reject max and less defined together', () => {
            const structure = { field: { type: 'number', required: true, max: 10, less: 20 } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede tener 'max' y 'less'/);
        });

        it('should reject multiple equal to 0', () => {
            const structure = { field: { type: 'number', required: true, multiple: 0 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.multiple' no puede ser 0/);
        });

        it('should reject integer:true combined with a non-zero precision', () => {
            const structure = { field: { type: 'number', required: true, integer: true, precision: 3 } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede tener 'integer' y 'precision'/);
        });

        it('should accept integer:true combined with precision:0', () => {
            const structure = { field: { type: 'number', required: true, integer: true, precision: 0 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('default value', () => {
        it('should reject a non-integer default when integer:true', () => {
            const structure = { field: { type: 'number', required: true, integer: true, default: 1.5 } };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser un entero porque 'integer' es true/);
        });

        it('should reject a default present in invalid', () => {
            const structure = { field: { type: 'number', required: true, invalid: [7, 8], default: 8 } };
            expect(() => new VODataStructure(structure)).toThrow(/no puede estar en la lista de valores inválidos/);
        });

        it('should reject a default absent from valid', () => {
            const structure = { field: { type: 'number', required: true, valid: [1, 2], default: 5 } };
            expect(() => new VODataStructure(structure)).toThrow(/debe estar en la lista de valores válidos/);
        });

        it('should reject a negative default when positive:true and negative:false', () => {
            const structure = {
                field: { type: 'number', required: true, positive: true, negative: false, default: -1 },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.default' debe ser positivo/);
        });

        it('should reject a positive default when negative:true and positive:false', () => {
            const structure = {
                field: { type: 'number', required: true, positive: false, negative: true, default: 1 },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.default' debe ser negativo/);
        });

        it('should accept a positive default when positive:true and negative:true (both allowed)', () => {
            const structure = {
                field: { type: 'number', required: true, positive: true, negative: true, default: 1 },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a negative default when only positive:true is set', () => {
            const structure = { field: { type: 'number', required: true, positive: true, default: -5 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.default' debe ser positivo/);
        });

        it('should reject a positive default when only negative:true is set', () => {
            const structure = { field: { type: 'number', required: true, negative: true, default: 5 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.default' debe ser negativo/);
        });

        it('should reject a default lower than min', () => {
            const structure = { field: { type: 'number', required: true, min: 10, default: 5 } };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser mayor o igual a 10/);
        });

        it('should reject a default higher than max', () => {
            const structure = { field: { type: 'number', required: true, max: 10, default: 15 } };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser menor o igual a 10/);
        });

        it('should reject a default lower than or equal to greater', () => {
            const structure = { field: { type: 'number', required: true, greater: 10, default: 10 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.default' debe ser mayor que 10/);
        });

        it('should reject a default higher than or equal to less', () => {
            const structure = { field: { type: 'number', required: true, less: 10, default: 10 } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.default' debe ser menor que 10/);
        });

        it('should reject a default that is not a multiple', () => {
            const structure = { field: { type: 'number', required: true, multiple: 3, default: 5 } };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser múltiplo de 3/);
        });

        it('should accept a default that is a multiple', () => {
            const structure = { field: { type: 'number', required: true, multiple: 3, default: 9 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a default out of port range when port:true', () => {
            const structure = { field: { type: 'number', required: true, port: true, default: 70000 } };
            expect(() => new VODataStructure(structure)).toThrow(/debe estar entre 0 y 65535/);
        });

        it('should accept a default within port range when port:true', () => {
            // Frontera exacta de `def > 65535`: el puerto maximo valido debe aceptarse.
            const structure = { field: { type: 'number', required: true, port: true, default: 65535 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject an unsafe default when unsafe:false', () => {
            const structure = {
                field: { type: 'number', required: true, unsafe: false, default: Number.MAX_SAFE_INTEGER + 100 },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe estar en el rango seguro de JavaScript/);
        });

        it('should accept an unsafe default when unsafe:true', () => {
            const structure = {
                field: { type: 'number', required: true, unsafe: true, default: Number.MAX_SAFE_INTEGER + 100 },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        // La guarda de produccion es `config.unsafe === false` (identidad estricta), no `!== true`:
        // con 'unsafe' SIN declarar la comprobacion de rango seguro no debe aplicarse.
        it('should accept an out-of-safe-range default when unsafe is not declared at all', () => {
            const structure = {
                field: { type: 'number', required: true, default: Number.MAX_SAFE_INTEGER + 100 },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a default with the wrong amount of decimals', () => {
            const structure = { field: { type: 'number', required: true, precision: 2, default: 1.234 } };
            expect(() => new VODataStructure(structure)).toThrow(/debe tener exactamente 2 decimales/);
        });

        // La comparacion de produccion es `decimals !== config.precision`, no `>`: un default con
        // MENOS decimales de los exigidos tambien debe rechazarse.
        it('should reject a default with fewer decimals than the required precision', () => {
            const structure = { field: { type: 'number', required: true, precision: 2, default: 1.2 } };
            expect(() => new VODataStructure(structure)).toThrow(/debe tener exactamente 2 decimales/);
        });

        it('should accept a default with exactly the required precision', () => {
            const structure = { field: { type: 'number', required: true, precision: 2, default: 1.23 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should accept a default with precision:0 and an integer-looking value', () => {
            const structure = { field: { type: 'number', required: true, precision: 0, default: 10 } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('ui block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject ui when it is %s', (_label, ui) => {
            const structure = { field: { type: 'number', required: true, ui } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui' debe ser un objeto/);
        });

        it('should reject ui with an unsupported key', () => {
            const structure = { field: { type: 'number', required: true, ui: { unknownKey: 1 } } };
            expect(() => new VODataStructure(structure)).toThrow(/contiene la clave no permitida 'unknownKey'/);
        });

        it('should reject ui.label when it is not a string', () => {
            const structure = { field: { type: 'number', required: true, ui: { label: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.label' debe ser string/);
        });

        it('should reject ui.css when it is not a string', () => {
            const structure = { field: { type: 'number', required: true, ui: { css: 42 } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.css' debe ser string/);
        });

        it('should reject an invalid ui.input_type', () => {
            const structure = { field: { type: 'number', required: true, ui: { input_type: 'slider' } } };
            expect(() => new VODataStructure(structure)).toThrow(/tiene un valor inválido/);
        });

        it('should reject a non-boolean ui.read_only', () => {
            const structure = { field: { type: 'number', required: true, ui: { read_only: 'yes' } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.read_only' debe ser booleano/);
        });

        it('should accept a fully populated valid ui object', () => {
            const structure = {
                field: {
                    type: 'number',
                    required: true,
                    ui: {
                        label: 'Cantidad',
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
            const structure = { field: { type: 'number', required: true, ui: { read_only: value } } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.read_only' debe ser booleano/);
        });
    });

    describe('sources block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject sources when it is %s', (_label, sources) => {
            const structure = { field: { type: 'number', required: true, sources } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.sources' debe ser un objeto/);
        });

        it('should reject sources with an unsupported key', () => {
            const structure = { field: { type: 'number', required: true, sources: { unknown_source: 'x' } } };
            expect(() => new VODataStructure(structure)).toThrow(/contiene la clave no permitida 'unknown_source'/);
        });

        it('should reject a sources URL that is not http(s)', () => {
            const structure = {
                field: { type: 'number', required: true, sources: { entities_source: 'ftp://x.com' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser una URL válida/);
        });

        it('should accept a valid http(s) source URL', () => {
            const structure = {
                field: { type: 'number', required: true, sources: { restflow_source: 'https://x.com/y' } },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });
});
