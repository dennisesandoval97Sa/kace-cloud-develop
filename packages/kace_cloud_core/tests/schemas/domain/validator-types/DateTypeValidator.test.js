import { VODataStructure } from '../../../../src/schemas/domain/VODataStructure.js';
import { ValidationFailError, UuidError } from '../../../../src/shared/index.js';

describe('DateTypeValidator - unit tests', () => {
    describe('unsupported keys', () => {
        it('should reject an unsupported top-level key', () => {
            const structure = { field: { type: 'date', required: true, timezoneFormat: 'withTimezone', trim: true } };
            expect(() => new VODataStructure(structure)).toThrow(
                /\[DateTypeValidator\] 'field' contains unsupported key\(s\): trim/
            );
        });
    });

    describe('empty / timestamp / iso combinations', () => {
        it('should reject empty when it is not a boolean', () => {
            const structure = { field: { type: 'date', required: true, timezoneFormat: 'withTimezone', empty: 'yes' } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.empty' must be a boolean/);
        });

        it('should reject an invalid timestamp value', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', timestamp: 'epoch' },
            };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.timestamp' must be either 'unix' or 'javascript'/
            );
        });

        it.each(['unix', 'javascript'])('should accept a valid timestamp value %s', (timestamp) => {
            const structure = { field: { type: 'date', required: true, timezoneFormat: 'withTimezone', timestamp } };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should serialize the default via parseDate using the "javascript" timestamp branch', () => {
            // parseDate() solo entra en la rama `timestamp === 'javascript'` cuando se le invoca de
            // verdad (via min/max/greater/less/default); fijar solo `timestamp: 'javascript'` sin
            // ninguno de esos atributos nunca llama a parseDate.
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    timestamp: 'javascript',
                    default: '2024-06-01',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        // El valor devuelto por la rama `timestamp` solo es observable si ADEMAS hay min/max/greater/less
        // contra el que compararlo. Con `default === max` no debe lanzar y con `default > max` si: ambas
        // cosas a la vez solo se cumplen si parseDate devuelve el epoch real (una constante fija haria
        // que las dos comparaciones dieran el mismo resultado).
        it.each(['javascript', 'unix'])(
            'should return the real epoch from the "%s" timestamp branch of parseDate',
            (timestamp) => {
                const equal = {
                    field: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withTimezone',
                        timestamp,
                        default: '2024-06-01',
                        max: '2024-06-01',
                    },
                };
                expect(() => new VODataStructure(equal)).not.toThrow();

                const later = {
                    field: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withTimezone',
                        timestamp,
                        default: '2024-06-01',
                        max: '2024-05-31',
                    },
                };
                expect(() => new VODataStructure(later)).toThrow(/'field.default' debe ser igual o anterior a/);
            }
        );

        it('should reject iso:true combined with timestamp', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', iso: true, timestamp: 'unix' },
            };
            expect(() => new VODataStructure(structure)).toThrow(
                /no puede tener 'iso' y 'timestamp' definidos al mismo tiempo/
            );
        });

        it('should accept iso:false combined with timestamp', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    iso: false,
                    timestamp: 'unix',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('min/max/greater/less combinations', () => {
        it('should reject min and greater defined together', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    min: '2024-06-01',
                    greater: '2024-05-01',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/no puede tener 'min' y 'greater'/);
        });

        it('should reject max and less defined together', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    max: '2024-06-30',
                    less: '2024-07-01',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/no puede tener 'max' y 'less'/);
        });

        it('should reject a greater timestamp value that is not a valid date', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    timestamp: 'javascript',
                    greater: 'not-a-date',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser una fecha válida en formato ISO/);
        });

        it('should reject greater equal to or later than less', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    greater: '2024-06-10',
                    less: '2024-06-10',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/no puede ser igual o posterior a/);
        });

        it('should accept greater strictly before less', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    greater: '2024-06-01',
                    less: '2024-06-10',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should accept computing the "now" keyword for greater', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    greater: 'now',
                    less: '2999-01-01',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        // 'now' tiene que resolverse a la fecha ACTUAL: comparado contra un 'less' en el pasado
        // reciente (calculado en tiempo de ejecucion, nunca una constante escrita a mano) la
        // validacion debe fallar. Si 'now' se resolviese a una fecha fija anterior (epoch 0, 2020...)
        // esta comparacion pasaria en silencio.
        it('should resolve the "now" keyword to the current date when compared against a past less', () => {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    greater: 'now',
                    less: yesterday,
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/no puede ser igual o posterior a/);
        });
    });

    describe('default value', () => {
        it('should reject a default that is not a parseable date, wrapping the parse error', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', default: 'not-a-date' },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser una fecha válida o 'now'/);
        });

        it('should accept the "now" keyword as default', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', default: 'now' },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        // Mismo motivo que arriba: sin un min/max contra el que comparar, `default: 'now'` no observa
        // el valor calculado. Con un 'max' de ayer (calculado en tiempo de ejecucion) debe lanzar.
        it('should resolve a default of "now" to the current date when max lies in the past', () => {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    max: yesterday,
                    default: 'now',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.default' debe ser igual o anterior a/);
        });

        it('should reject a default earlier than min', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    min: '2024-06-10',
                    default: '2024-06-01',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser igual o posterior a 'field.min'/);
        });

        it('should accept a default equal to min', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    min: '2024-06-10',
                    default: '2024-06-10',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a default later than max', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    max: '2024-06-10',
                    default: '2024-06-15',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser igual o anterior a 'field.max'/);
        });

        it('should accept a default equal to max', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    max: '2024-06-10',
                    default: '2024-06-10',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a default earlier than or equal to greater', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    greater: '2024-06-10',
                    default: '2024-06-10',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(
                /'field.default' debe ser posterior a 'field.greater'/
            );
        });

        it('should accept a default strictly after greater', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    greater: '2024-06-01',
                    default: '2024-06-10',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a default later than or equal to less', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    less: '2024-06-10',
                    default: '2024-06-10',
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.default' debe ser anterior a 'field.less'/);
        });

        it('should accept a default strictly before less', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    less: '2024-06-10',
                    default: '2024-06-01',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('restflow_id', () => {
        it('should accept a well-formed restflow_id uuid', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    restflow_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });

        it('should reject a malformed restflow_id', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', restflow_id: 'not-a-uuid' },
            };
            expect(() => new VODataStructure(structure)).toThrow(UuidError);
        });

        // La guarda de produccion es `hasOwnProperty('restflow_id') && config.restflow_id`: sin la
        // segunda mitad, un restflow_id nulo instanciaria el ValueObjectUuid y lanzaria.
        it('should accept a null restflow_id without instantiating the uuid validator', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', restflow_id: null },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });

    describe('ui block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject ui when it is %s', (_label, ui) => {
            const structure = { field: { type: 'date', required: true, timezoneFormat: 'withTimezone', ui } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui' debe ser un objeto/);
        });

        it('should reject ui with an unsupported key', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', ui: { unknownKey: 1 } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/contiene la clave no permitida 'unknownKey'/);
        });

        it('should reject ui.label when it is not a string', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', ui: { label: 42 } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.label' debe ser string/);
        });

        it('should reject ui.css when it is not a string', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', ui: { css: 42 } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.css' debe ser string/);
        });

        it('should reject an invalid ui.input_type', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    ui: { input_type: 'slider' },
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/tiene un valor inválido/);
        });

        it('should reject a non-boolean ui.is_visible', () => {
            const structure = {
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', ui: { is_visible: 'yes' } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.is_visible' debe ser booleano/);
        });

        it('should accept a fully populated valid ui object', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    ui: {
                        label: 'Fecha',
                        css: 'text-right',
                        input_type: 'date',
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
                field: { type: 'date', required: true, timezoneFormat: 'withTimezone', ui: { read_only: value } },
            };
            expect(() => new VODataStructure(structure)).toThrow(/'field.ui.read_only' debe ser booleano/);
        });
    });

    describe('sources block', () => {
        it.each([
            ['a string', 'not-an-object'],
            ['an array', []],
        ])('should reject sources when it is %s', (_label, sources) => {
            const structure = { field: { type: 'date', required: true, timezoneFormat: 'withTimezone', sources } };
            expect(() => new VODataStructure(structure)).toThrow(/'field.sources' debe ser un objeto/);
        });

        it('should reject sources with an unsupported key', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    sources: { unknown_source: 'x' },
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/contiene la clave no permitida 'unknown_source'/);
        });

        it('should reject a sources URL that is not http(s)', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    sources: { entities_source: 'ftp://x.com' },
                },
            };
            expect(() => new VODataStructure(structure)).toThrow(/debe ser una URL válida/);
        });

        it('should accept a valid http(s) source URL', () => {
            const structure = {
                field: {
                    type: 'date',
                    required: true,
                    timezoneFormat: 'withTimezone',
                    sources: { restflow_source: 'https://x.com/y' },
                },
            };
            expect(() => new VODataStructure(structure)).not.toThrow();
        });
    });
});
