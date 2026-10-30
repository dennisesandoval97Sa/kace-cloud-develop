import { v4 as uuidv4 } from 'uuid';
import { Schema } from '../../../src/schemas/domain/Schema.js';

export class SchemasMother {
    static dto(overrides = {}) {
        return {
            id: uuidv4(),
            name: 'schema_test',
            is_active: true,
            data_structure: {
                campo1: {
                    type: 'number',
                    required: true,
                    integer: true,
                    min: 0,
                    less: 105,
                    precision: 0,
                    multiple: 5,
                    positive: true,
                    negative: false,
                    unsafe: false,
                    port: true,
                    valid: [10, 20, 30],
                    invalid: [-1, 999],
                    default: 10,
                },
            },
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
            deleted_at: null,
            deleted_by: null,
            ...overrides,
        };
    }

    /**
     * @param {KnexSchemasRepository | null} repository
     * @param overrides
     */
    static async create(overrides = {}, repository = null) {
        const schema = Schema.create(SchemasMother.dto(overrides));
        if (repository !== null) {
            await repository.save(schema);
        }
        return schema;
    }

    static validNumberStructure(overrides = {}) {
        return {
            campo1: {
                type: 'number',
                required: true,
                integer: false,
                min: 0,
                less: 101,
                precision: 2,
                positive: true,
                negative: false,
                unsafe: false,
                port: true,
                valid: [10.02, 20.05, 30.09],
                invalid: [-1, 999],
                default: 10.02,
            },
            ...overrides,
        };
    }

    static validDateStructure(overrides = {}) {
        return {
            campo2: {
                type: 'date',
                required: true,
                iso: false,
                timestamp: 'unix',
                timezoneFormat: 'withTimezone',
                max: '2030-12-31',
                greater: '2020-01-01',
                default: 'now',
            },
            ...overrides,
        };
    }

    static invalidTypeStructure() {
        return {
            campo3: {
                type: 'string',
                required: true,
            },
        };
    }

    static missingRequiredProperty() {
        return {
            campo4: {
                type: 'number',
            },
        };
    }

    static invalidNumberPropertyType() {
        return {
            campo5: {
                type: 'number',
                required: true,
                min: 'no-es-numero',
            },
        };
    }

    static invalidDatePropertyType() {
        return {
            campo6: {
                type: 'date',
                required: true,
                iso: 'no-es-booleano',
            },
        };
    }

    static validObjectStructure(overrides = {}) {
        return {
            persona: {
                type: 'object',
                required: true,
                schema_id: uuidv4(),
            },
            ...overrides,
        };
    }

    static invalidObjectMissingTypeInKey() {
        return {
            persona: {
                required: true,
                schema_id: uuidv4(),
            },
        };
    }

    static invalidObjectUnsupportedTypeInKey() {
        return {
            persona: {
                type: 'unsupported',
                required: true,
                schema_id: uuidv4(),
            },
        };
    }

    static validNestedObjectStructure() {
        return {
            empresa: {
                type: 'object',
                required: true,
                schema_id: uuidv4(),
            },
        };
    }

    static validArrayStructure(overrides = {}) {
        return {
            contacts: {
                type: 'array',
                required: true,
                schema_id: uuidv4(),
            },
            ...overrides,
        };
    }

    static invalidArrayMissingType() {
        return {
            contacts: {
                required: true,
                schema_id: uuidv4(),
            },
        };
    }

    static invalidArrayInvalidSchemaId() {
        return {
            contacts: {
                type: 'array',
                required: true,
                schema_id: 'not-a-uuid',
            },
        };
    }

    static invalidArrayUnexpectedKey() {
        return {
            contacts: {
                type: 'array',
                required: true,
                schema_id: uuidv4(),
                extra: 'not-allowed',
            },
        };
    }

    static stringMinGreaterThanMax() {
        return {
            field: {
                type: 'string',
                required: true,
                min: 10,
                max: 5,
            },
        };
    }

    static stringValidAndInvalidOverlap() {
        return {
            field: {
                type: 'string',
                required: true,
                valid: ['a', 'b', 'c'],
                invalid: ['c', 'd'],
            },
        };
    }

    static stringLengthWithMinOrMax() {
        return {
            field: {
                type: 'string',
                required: true,
                length: 5,
                min: 2,
            },
        };
    }

    static stringDefaultNotInValid() {
        return {
            field: {
                type: 'string',
                required: true,
                valid: ['a', 'b', 'c'],
                default: 'z',
            },
        };
    }

    static stringDefaultInInvalid() {
        return {
            field: {
                type: 'string',
                required: true,
                invalid: ['x', 'y', 'z'],
                default: 'z',
            },
        };
    }

    static stringDefaultWrongLength() {
        return {
            field: {
                type: 'string',
                required: true,
                length: 4,
                default: 'abc',
            },
        };
    }

    static stringDefaultWrongMin() {
        return {
            field: {
                type: 'string',
                required: true,
                min: 5,
                default: 'abc',
            },
        };
    }

    static stringDefaultWrongMax() {
        return {
            field: {
                type: 'string',
                required: true,
                max: 2,
                default: 'abcd',
            },
        };
    }

    static stringDefaultPatternFail() {
        return {
            field: {
                type: 'string',
                required: true,
                pattern: /^[A-Z]+$/,
                default: 'abc',
            },
        };
    }

    static stringDefaultNotAlphanum() {
        return {
            field: {
                type: 'string',
                required: true,
                alphanum: true,
                default: 'abc!',
            },
        };
    }

    static stringDefaultNotLowercase() {
        return {
            field: {
                type: 'string',
                required: true,
                lowercase: true,
                default: 'ABC',
            },
        };
    }

    static stringDefaultNotUppercase() {
        return {
            field: {
                type: 'string',
                required: true,
                uppercase: true,
                default: 'abc',
            },
        };
    }

    static stringValidAll() {
        return {
            field: {
                type: 'string',
                required: true,
                min: 2,
                max: 5,
                valid: ['abc', 'def'],
                invalid: ['xyz'],
                default: 'abc',
                alphanum: true,
                lowercase: true,
                pattern: /^[a-z]+$/,
            },
        };
    }

    static numberMinGreaterThanMax() {
        return {
            field: {
                type: 'number',
                required: true,
                min: 10,
                max: 5,
            },
        };
    }

    static numberGreaterGteLess() {
        return {
            field: {
                type: 'number',
                required: true,
                greater: 10,
                less: 10,
            },
        };
    }

    static numberMinAndGreater() {
        return {
            field: {
                type: 'number',
                required: true,
                min: 5,
                greater: 2,
            },
        };
    }

    static numberMaxAndLess() {
        return {
            field: {
                type: 'number',
                required: true,
                max: 10,
                less: 20,
            },
        };
    }

    static numberMultipleZero() {
        return {
            field: {
                type: 'number',
                required: true,
                multiple: 0,
            },
        };
    }

    static numberDefaultNotInteger() {
        return {
            field: {
                type: 'number',
                required: true,
                integer: true,
                default: 1.5,
            },
        };
    }

    static numberDefaultNotInValid() {
        return {
            field: {
                type: 'number',
                required: true,
                valid: [1, 2, 3],
                default: 5,
            },
        };
    }

    static numberDefaultInInvalid() {
        return {
            field: {
                type: 'number',
                required: true,
                invalid: [7, 8, 9],
                default: 8,
            },
        };
    }

    static numberDefaultNotPositive() {
        return {
            field: {
                type: 'number',
                required: true,
                positive: true,
                default: -1,
            },
        };
    }

    static numberDefaultNotNegative() {
        return {
            field: {
                type: 'number',
                required: true,
                negative: true,
                default: 1,
            },
        };
    }

    static numberDefaultNotMultiple() {
        return {
            field: {
                type: 'number',
                required: true,
                multiple: 3,
                default: 5,
            },
        };
    }

    static numberDefaultOutOfPortRange() {
        return {
            field: {
                type: 'number',
                required: true,
                port: true,
                default: 70000,
            },
        };
    }

    static numberDefaultUnsafe() {
        return {
            field: {
                type: 'number',
                required: true,
                unsafe: false,
                default: Number.MAX_SAFE_INTEGER + 100,
            },
        };
    }

    static numberDefaultWrongPrecision() {
        return {
            field: {
                type: 'number',
                required: true,
                precision: 2,
                default: 1.234,
            },
        };
    }

    static numberValidAll() {
        return {
            field: {
                type: 'number',
                required: true,
                min: 2,
                max: 10,
                valid: [4, 6, 8],
                invalid: [9],
                default: 4,
                integer: true,
                positive: true,
                multiple: 2,
                port: true,
                unsafe: false,
                precision: 0,
            },
        };
    }

    static numberValidAndInvalidOverlap() {
        return {
            field: {
                type: 'number',
                required: true,
                valid: [1, 2, 3],
                invalid: [3, 4],
            },
        };
    }

    static booleanTruthyWithSpecialChars() {
        return {
            field: {
                type: 'boolean',
                required: true,
                truthyValues: ['yes', 'ok!'],
            },
        };
    }

    static booleanFalsyWithSpaces() {
        return {
            field: {
                type: 'boolean',
                required: true,
                falsyValues: ['no', 'not allowed'],
            },
        };
    }

    static booleanTruthyFalsyOverlap() {
        return {
            field: {
                type: 'boolean',
                required: true,
                truthyValues: ['yes', 'ok'],
                falsyValues: ['ok', 'no'],
            },
        };
    }

    static booleanTruthyWithDuplicates() {
        return {
            field: {
                type: 'boolean',
                required: true,
                truthyValues: ['yes', 'yes'],
            },
        };
    }

    static booleanFalsyWithDuplicates() {
        return {
            field: {
                type: 'boolean',
                required: true,
                falsyValues: ['no', 'no'],
            },
        };
    }

    static booleanTruthyEmpty() {
        return {
            field: {
                type: 'boolean',
                required: true,
                truthyValues: [],
            },
        };
    }

    static booleanFalsyEmpty() {
        return {
            field: {
                type: 'boolean',
                required: true,
                falsyValues: [],
            },
        };
    }

    static booleanTruthyWithNullUndefinedEmpty() {
        return {
            field: {
                type: 'boolean',
                required: true,
                truthyValues: ['yes', null, undefined, ''],
            },
        };
    }

    static booleanDefaultNotAllowed() {
        return {
            field: {
                type: 'boolean',
                required: true,
                truthyValues: ['yes'],
                falsyValues: ['no'],
                default: 'maybe',
            },
        };
    }

    static booleanDefaultInTruthy() {
        return {
            field: {
                type: 'boolean',
                required: true,
                truthyValues: ['yes', 'ok'],
                default: 'yes',
            },
        };
    }

    static booleanDefaultInFalsy() {
        return {
            field: {
                type: 'boolean',
                required: true,
                falsyValues: ['no', 'fail'],
                default: 'fail',
            },
        };
    }

    static booleanDefaultBoolean() {
        return {
            field: {
                type: 'boolean',
                required: true,
                default: false,
            },
        };
    }

    static dateMinGreaterThanMax() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                min: '2024-06-10',
                max: '2024-06-01',
            },
        };
    }

    static dateGreaterGteLess() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                greater: '2024-06-10',
                less: '2024-06-10',
            },
        };
    }

    static dateMinAndGreater() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                min: '2024-06-01',
                greater: '2024-05-01',
            },
        };
    }

    static dateMaxAndLess() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                max: '2024-06-30',
                less: '2024-07-01',
            },
        };
    }

    static dateIntegerAndPrecision() {
        return {
            field: {
                type: 'number',
                required: true,
                integer: true,
                precision: 3,
            },
        };
    }

    static dateDefaultNotString() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                default: 12345,
            },
        };
    }

    static dateDefaultInvalidString() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                default: 'not-a-date',
            },
        };
    }

    static dateDefaultOutOfMin() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                min: '2024-06-10',
                default: '2024-06-01',
            },
        };
    }

    static dateDefaultOutOfMax() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                max: '2024-06-10',
                default: '2024-06-15',
            },
        };
    }

    static dateDefaultOutOfGreater() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                greater: '2024-06-10',
                default: '2024-06-10',
            },
        };
    }

    static dateDefaultOutOfLess() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                less: '2024-06-10',
                default: '2024-06-10',
            },
        };
    }

    static dateValidAll() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                min: '2024-06-01',
                max: '2024-06-30',
                default: '2024-06-15',
            },
        };
    }

    static dateMinNowMaxPast() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                min: 'now',
                max: '2024-06-01',
            },
        };
    }

    static dateGreaterNowLessPast() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                greater: 'now',
                less: '2024-06-01',
            },
        };
    }

    static dateTimestampUnixInvalid() {
        return {
            fecha: {
                type: 'date',
                required: true,
                timestamp: 'unix',
                timezoneFormat: 'withTimezone',
                min: 'not-a-timestamp',
            },
        };
    }

    static dateTimestampJsInvalid() {
        return {
            field: {
                type: 'date',
                required: true,
                timestamp: 'javascript',
                timezoneFormat: 'withTimezone',
                min: 'not-a-timestamp',
            },
        };
    }

    static fieldNameWithDot() {
        return {
            'campo.con.punto': {
                type: 'string',
                required: true,
            },
        };
    }

    static fieldNameTooLong() {
        const longName = 'c'.repeat(46);
        return {
            [longName]: {
                type: 'string',
                required: true,
            },
        };
    }

    static async createAuxCaseNestedExampleSchema(repository) {
        const schemas = [
            {
                id: '1b631ee3-5115-42b8-a864-6863673753a2',
                name: 'aux_cases',
                is_active: true,
                data_structure: {
                    'form_212b8fae-30e4-4f89-b18a-84f594f2d1ec': {
                        type: 'object',
                        required: false,
                        schema_id: '0c4f1318-bc34-4a43-9a60-2d0ad9173804',
                    },
                    'form_5f4bdeb5-98cb-4bba-8c26-3183478eceee': {
                        type: 'object',
                        required: false,
                        schema_id: '9852ac22-9efe-455d-9891-4086aa2a4efb',
                    },
                    'form_6a22819b-dee9-493b-819d-cc2344400d7b': {
                        type: 'object',
                        required: false,
                        schema_id: '8773d8c2-b2ca-4db7-8b5a-fce734e100cc',
                    },
                    'form_9368b49d-b095-4b28-843f-c59ec516138f': {
                        type: 'object',
                        required: false,
                        schema_id: '85338686-1061-4d2a-84ae-c7699fcac64f',
                    },
                    'form_b25b51a4-ae03-4155-b8d1-a26aae34e7b0': {
                        type: 'object',
                        required: false,
                        schema_id: '69476407-2e42-47c1-bde8-9beef79c1052',
                    },
                    'form_ef61161d-4dd2-4a2e-87f4-1d2e936ec315': {
                        type: 'object',
                        required: false,
                        schema_id: '8552271b-9fdb-4199-a315-882f7dd46cf6',
                    },
                },
            },
            {
                id: '0c4f1318-bc34-4a43-9a60-2d0ad9173804',
                name: 'form_212b8fae-30e4-4f89-b18a-84f594f2d1ec',
                is_active: true,
                data_structure: {
                    causal: { type: 'string', empty: true, required: false },
                    ciudad: { type: 'string', required: false },
                    tipo_qr: { type: 'string', required: false },
                    extension: { type: 'string', required: false },
                    respuesta: { type: 'string', required: false },
                    estado_pig: { type: 'string', required: false },
                    extension1: { type: 'string', required: false },
                    cuenta_qr_1: { type: 'string', required: false },
                    cuenta_qr_2: { type: 'string', required: false },
                    cuenta_qr_3: { type: 'string', required: false },
                    departamento: { type: 'string', required: false },
                    fecha_evento: { type: 'string', required: false },
                    tipo_cliente: { type: 'string', required: false },
                    observaciones: { type: 'string', required: false },
                    campanyasActivas: { type: 'string', required: false },
                    tipo_cuenta_qr_1: { type: 'string', required: false },
                    tipo_cuenta_qr_2: { type: 'string', required: false },
                    tipo_cuenta_qr_3: { type: 'string', required: false },
                    telefono_contacto: { type: 'string', required: false },
                    cuenta_bancaria_qr: { type: 'string', required: false },
                    cantidad_habladores: { type: 'string', required: false },
                    rvq_tipo_vinculacion: { type: 'string', required: false },
                    qr_impreso_asesor_campo: { type: 'string', required: false },
                    rvq_tipo_cuenta_bancaria: { type: 'string', required: false },
                    nombre_estrategia_comercial: { type: 'string', required: false },
                },
            },
            {
                id: '9852ac22-9efe-455d-9891-4086aa2a4efb',
                name: 'form_5f4bdeb5-98cb-4bba-8c26-3183478eceee',
                is_active: true,
                data_structure: {
                    causal: { type: 'string', required: false },
                    extension: { type: 'string', required: false },
                    respuesta: { type: 'string', required: false },
                    extension1: { type: 'string', required: false },
                    departamento: { type: 'string', required: false },
                    observaciones: { type: 'string', required: false },
                    cuenta_wompi_1: { type: 'string', required: false },
                    cuenta_wompi_2: { type: 'string', required: false },
                    cuenta_wompi_3: { type: 'string', required: false },
                    campanyasActivas: { type: 'string', required: false },
                    telefono_contacto: { type: 'string', required: false },
                    tipo_cliente_wompi: { type: 'string', required: false },
                    tipo_cuenta_wompi_1: { type: 'string', required: false },
                    tipo_cuenta_wompi_2: { type: 'string', required: false },
                    tipo_cuenta_wompi_3: { type: 'string', required: false },
                    cuenta_bancaria_wompi: { type: 'string', required: false },
                    estado_vinculacion_wompi: { type: 'string', required: false },
                    tipo_inconveniente_wompi: { type: 'string', required: false },
                    vinculacion_exitosa_wompi: { type: 'string', required: false },
                    tipo_cuenta_bancaria_wompi: { type: 'string', required: false },
                },
            },
            {
                id: '8773d8c2-b2ca-4db7-8b5a-fce734e100cc',
                name: 'form_6a22819b-dee9-493b-819d-cc2344400d7b',
                is_active: true,
                data_structure: {
                    causal: { type: 'string', required: false },
                    extension: { type: 'string', required: false },
                    respuesta: { type: 'string', required: false },
                    extension1: { type: 'string', required: false },
                    departamento: { type: 'string', required: false },
                    observaciones: { type: 'string', required: false },
                    campanyasActivas: { type: 'string', required: false },
                    telefono_contacto: { type: 'string', required: false },
                },
            },
            {
                id: '85338686-1061-4d2a-84ae-c7699fcac64f',
                name: 'form_9368b49d-b095-4b28-843f-c59ec516138f',
                is_active: true,
                data_structure: {
                    mcc: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    ciiu: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    otro: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    email: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    causal: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    ciudad: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    cuenta_1: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    cuenta_2: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    cuenta_3: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    extension: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    respuesta: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tasa_amex: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tasa_visa: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    extension1: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tecnologia: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_abono: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_venta: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    appointments: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    departamento: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    observaciones: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_comercio: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_cuenta_1: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_cuenta_2: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_cuenta_3: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    puntos_de_venta: {
                        type: 'array',
                        required: false,
                        schema_id: 'b7e396a4-d5a3-47e0-8b47-3f50c5d8a8e4',
                    },
                    tasa_mastercard: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    campanyasActivas: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    exportable_tasas: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    fecha_radicacion: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_vinculacion: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    fecha_instalacion: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    radicacion_bizagi: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tecnologia_redban: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    telefono_contacto: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    cantidad_datafonos: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    facturacion_mensual: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    numero_puntos_venta: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    vinculacion_exitosa: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    area_local_comercial: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    negociacion_comision: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    perfiles_ocupaciones: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    registro_fotografico: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    rva_tipo_vinculacion: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    valor_promedio_venta: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    actividad_alto_riesgo: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    tecnologia_credibanco: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    vinculado_bancolombia: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    fecha_respuesta_bizagi: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_1: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_2: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_3: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_4: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_5: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    documentos_para_estudio: {
                        type: 'object',
                        required: false,
                        schema_id: '4413f613-9b9d-4c45-890b-2ec37d39e618',
                    },
                    cuantas_personas_laboran: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    cliente_acepta_perfilacion: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    relacion_inmueble_vehiculo: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    cliente_cumple_cobertura_adq: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    cliente_deacuerdo_vinculacion: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    antiguedad_actividad_comercial: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    comercio_actividad_alto_riesgo: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    fecha_nacimiento_representante: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                },
            },
            {
                id: '69476407-2e42-47c1-bde8-9beef79c1052',
                name: 'form_b25b51a4-ae03-4155-b8d1-a26aae34e7b0',
                is_active: true,
                data_structure: {
                    causal: { type: 'string', required: false },
                    extension: { type: 'string', required: false },
                    respuesta: { type: 'string', required: false },
                    extension1: { type: 'string', required: false },
                    departamento: { type: 'string', required: false },
                    observaciones: { type: 'string', required: false },
                    campanyasActivas: { type: 'string', required: false },
                    telefono_contacto: { type: 'string', required: false },
                },
            },
            {
                id: '8552271b-9fdb-4199-a315-882f7dd46cf6',
                name: 'form_ef61161d-4dd2-4a2e-87f4-1d2e936ec315',
                is_active: true,
                data_structure: {
                    mcc: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    ciiu: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    otro: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    email: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    causal: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    ciudad: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    cuenta_1: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    cuenta_2: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    cuenta_3: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    citasCaso: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    extension: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    respuesta: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tasa_amex: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tasa_visa: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    extension1: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tecnologia: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_abono: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_venta: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    labelAgenda: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    departamento: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    observaciones: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_comercio: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_cuenta_1: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_cuenta_2: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_cuenta_3: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    puntos_de_venta: {
                        type: 'array',
                        required: false,
                        schema_id: 'b7e396a4-d5a3-47e0-8b47-3f50c5d8a8e4',
                    },
                    tasa_mastercard: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    campanyasActivas: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    exportable_tasas: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    fecha_radicacion: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tipo_vinculacion: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    fecha_instalacion: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    radicacion_bizagi: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    tecnologia_redban: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    telefono_contacto: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    cantidad_datafonos: { trim: false, type: 'string', empty: false, alphanum: false, required: false },
                    facturacion_mensual: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    numero_puntos_venta: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    vinculacion_exitosa: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    area_local_comercial: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    negociacion_comision: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    perfiles_ocupaciones: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    registro_fotografico: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    rva_tipo_vinculacion: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    valor_promedio_venta: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    actividad_alto_riesgo: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    tecnologia_credibanco: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    vinculado_bancolombia: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    fecha_respuesta_bizagi: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_1: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_2: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_3: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_4: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    codigo_unico_comercio_5: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    documentos_para_estudio: {
                        type: 'object',
                        required: false,
                        schema_id: '4413f613-9b9d-4c45-890b-2ec37d39e618',
                    },
                    cuantas_personas_laboran: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    cliente_acepta_perfilacion: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    relacion_inmueble_vehiculo: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    cliente_cumple_cobertura_adq: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    cliente_deacuerdo_vinculacion: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    antiguedad_actividad_comercial: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    comercio_actividad_alto_riesgo: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                    fecha_nacimiento_representante: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        alphanum: false,
                        required: false,
                    },
                },
            },
            {
                id: 'b7e396a4-d5a3-47e0-8b47-3f50c5d8a8e4',
                name: 'puntos_de_venta',
                is_active: true,
                data_structure: {
                    cuenta_bancaria: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        default: '34',
                        alphanum: false,
                        required: false,
                        restflow_id: null,
                    },
                    direccion_punto_venta: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        default: '34',
                        alphanum: false,
                        required: false,
                        restflow_id: null,
                    },
                    rva_tipo_cuenta_bancaria: {
                        trim: false,
                        type: 'string',
                        empty: false,
                        default: '34',
                        alphanum: false,
                        required: false,
                        restflow_id: null,
                    },
                },
            },
            {
                id: '4413f613-9b9d-4c45-890b-2ec37d39e618',
                name: 'documentos_para_estudio',
                is_active: true,
                data_structure: {
                    RUT: {
                        type: 'boolean',
                        default: false,
                        required: false,
                    },
                    Camara_de_comercio: {
                        type: 'boolean',
                        default: false,
                        required: false,
                    },
                    Documento_de_identidad: {
                        type: 'boolean',
                        default: false,
                        required: false,
                    },
                    Formato_de_vinculacion_fotografico: {
                        type: 'boolean',
                        default: false,
                        required: false,
                    },
                    Registro_fotografico_eagle_fachada: {
                        type: 'boolean',
                        default: false,
                        required: false,
                    },
                },
            },
        ];

        // `forEach` no espera a las funciones async: la version anterior devolvia el array
        // con los seis INSERT todavia en vuelo y el test corria SchemaRules contra una tabla
        // a medio sembrar. De ahi que fallara una de cada seis corridas con el
        // `data_structure` de un formulario anidado sin definir. Se siembra en serie, ademas,
        // porque el schema raiz referencia a los otros cinco por `schema_id`.
        for (const schema of schemas) {
            await SchemasMother.create(schema, repository);
        }

        return schemas;
    }

    // --- Timezone-related test data ---

    static dateWithTimezoneFormatWithTimezone() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
            },
        };
    }

    static dateWithTimezoneFormatWithoutTimezone() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withoutTimezone',
                timezone: 'America/Bogota',
            },
        };
    }

    static dateWithTimezoneFormatWithTimezoneAndTimestamp() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                timestamp: 'javascript',
            },
        };
    }

    static dateWithTimezoneFormatWithoutTimezoneAndTimestamp() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withoutTimezone',
                timezone: 'America/Bogota',
                timestamp: 'javascript',
            },
        };
    }

    static dateWithInvalidTimezoneFormat() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'invalidFormat',
            },
        };
    }

    static dateWithInvalidTimezone() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withoutTimezone',
                timezone: 'Invalid/Timezone',
            },
        };
    }

    static dateWithNonStringTimezoneFormat() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 123,
            },
        };
    }

    static dateWithNonStringTimezone() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withoutTimezone',
                timezone: 123,
            },
        };
    }

    static dateWithValidTimezoneAll() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withoutTimezone',
                timezone: 'America/Bogota',
                min: '2024-06-01',
                max: '2024-06-30',
                default: '2024-06-15',
            },
        };
    }

    static dateWithTimezoneFormatWithTimezoneAndUnixTimestamp() {
        return {
            field: {
                type: 'date',
                required: true,
                timezoneFormat: 'withTimezone',
                timestamp: 'unix',
            },
        };
    }
}
