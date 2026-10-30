import { jest } from '@jest/globals';
import SchemaBuilder from '../src/SchemaBuilder';
import Joi from 'joi';
import SchemasBuilderMother from './SchemasBuilderMother';
import { parseNumber } from '../src/builders/NumberSchemaBuilder';

describe('SchemaBuilder', () => {
    it('debería transformar un DTO de tipo string en un esquema Joi válido', () => {
        const dto = SchemasBuilderMother.stringDto();
        const schema = SchemaBuilder.build(dto);
        const { error } = schema.validate('abc123');
        expect(error).toBeUndefined();
    });

    it('debería aplicar validación uuid si restflow_id está presente', () => {
        const dto = SchemasBuilderMother.stringWithRestflowIdDto();
        const schema = SchemaBuilder.build(dto);
        const { error } = schema.validate(dto.restflow_id);
        expect(error).toBeUndefined();
        const { error: error2 } = schema.validate('no-es-uuid');
        expect(error2).toBeDefined();
    });

    it('debería aplicar todas las opciones relevantes de Joi para string', () => {
        const dto = SchemasBuilderMother.stringWithAllOptionsDto({ length: 5, trim: true });
        const schema = SchemaBuilder.build(dto);
        const { error } = schema.validate('abcde');
        expect(error).toBeUndefined();
        const { error: error2 } = schema.validate('abcd');
        expect(error2).toBeDefined();
    });

    it('debería aplicar min correctamente cuando llega como string y no perder required', () => {
        const dto = { type: 'string', required: true, min: '5' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        expect(schema.validate('abcd').error?.details[0].type).toBe('string.min');
        expect(schema.validate('abcde').error).toBeUndefined();
    });

    it('debería aplicar max correctamente cuando llega como string y no perder required', () => {
        const dto = { type: 'string', required: true, max: '5' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        expect(schema.validate('abcdef').error?.details[0].type).toBe('string.max');
        expect(schema.validate('abcde').error).toBeUndefined();
    });

    it('debería aplicar length correctamente cuando llega como string y no perder required', () => {
        const dto = { type: 'string', required: true, length: '4' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        expect(schema.validate('abc').error?.details[0].type).toBe('string.length');
        expect(schema.validate('abcd').error).toBeUndefined();
    });

    it('no debería perder required cuando min, max o length contienen valores inválidos o negativos', () => {
        const dtoMin = { type: 'string', required: true, min: 'invalid' };
        expect(SchemaBuilder.build(dtoMin).validate(undefined).error?.details[0].type).toBe('any.required');

        const dtoMinNeg = { type: 'string', required: true, min: -1 };
        expect(SchemaBuilder.build(dtoMinNeg).validate(undefined).error?.details[0].type).toBe('any.required');

        const dtoMax = { type: 'string', required: true, max: 'invalid' };
        expect(SchemaBuilder.build(dtoMax).validate(undefined).error?.details[0].type).toBe('any.required');

        const dtoLen = { type: 'string', required: true, length: 'invalid' };
        expect(SchemaBuilder.build(dtoLen).validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it('no debería perder required cuando pattern contiene una expresión regular con sintaxis inválida', () => {
        const dto = { type: 'string', required: true, pattern: { regex: '[' } };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it('debería fallar si el tipo no está soportado', () => {
        const dto = { type: 'unsupported_type' };
        expect(() => SchemaBuilder.build(dto)).toThrow('Tipo no soportado');
    });

    it('debería construir la estructura interna correcta del schema Joi para string', () => {
        const dto = SchemasBuilderMother.stringDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description).toMatchObject({
            type: 'string',
            flags: { presence: 'required' },
            rules: expect.arrayContaining([
                { name: 'min', args: { limit: dto.min } },
                { name: 'max', args: { limit: dto.max } },
                { name: 'alphanum' },
            ]),
        });
    });

    it('debería construir la estructura interna correcta del schema Joi para string con restflow_id', () => {
        const dto = SchemasBuilderMother.stringWithRestflowIdDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description).toMatchObject({
            type: 'string',
            rules: expect.arrayContaining([{ name: 'guid' }]),
        });
    });

    it('debería construir la estructura interna correcta del schema Joi para string con todas las opciones', () => {
        const dto = SchemasBuilderMother.stringWithAllOptionsDto({ length: 5, trim: true });
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description).toMatchObject({
            type: 'string',
            rules: expect.arrayContaining([
                { name: 'length', args: { limit: 5 } },
                { name: 'trim', args: { enabled: true } },
            ]),
        });
    });

    it('debería construir la estructura interna correcta del schema Joi para number', () => {
        const dto = SchemasBuilderMother.numberDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description).toMatchObject({
            type: 'number',
            flags: { presence: 'required', default: 5 },
            rules: expect.arrayContaining([
                { name: 'min', args: { limit: 1 } },
                { name: 'max', args: { limit: 10 } },
                { name: 'greater', args: { limit: 0 } },
                { name: 'less', args: { limit: 20 } },
                { name: 'precision', args: { limit: 2 } },
                { name: 'multiple', args: expect.objectContaining({ base: 2 }) },
                { name: 'integer' },
                { name: 'sign', args: { sign: 'positive' } },
            ]),
        });
        expect(description.allow).toEqual(expect.arrayContaining([2, 4, 6]));
        const invalids = description.invalids || description.invalid;
        expect(invalids).toEqual(expect.arrayContaining([1, 3, 5]));
    });

    it('debería rechazar correctamente un número cuando la lista invalid contiene strings numéricos', () => {
        const dto = {
            type: 'number',
            invalid: ['3421', ' ', 'abc', null], // Mezcla de strings no numéricos y strings numéricos válidos
        };
        const schema = SchemaBuilder.build(dto);

        const { error: errorNum } = schema.validate(3421);
        expect(errorNum).toBeDefined();
        expect(errorNum.details[0].type).toBe('any.invalid');

        const { error: errorStr } = schema.validate('3421');
        expect(errorStr).toBeDefined();
        expect(errorStr.details[0].type).toBe('any.invalid');

        const { error: errorValid } = schema.validate(10);
        expect(errorValid).toBeUndefined();
    });

    it('no debería aplicar la restricción invalid cuando el array contiene solo valores no numéricos', () => {
        // Regresión del bug: con el código viejo, applyNumericListConstraint no existía y
        // parseNumberList pasaba los valores sin filtrar a s.invalid(), registrando strings
        // ('abc', ' ', 'Infinity') y null en la descripción interna de Joi.
        // Con el fix, ninguno pasa el filtro `typeof v === 'number' && isFinite(v)`,
        // así que .invalid() nunca se llama y la descripción no debe tener numéricos inválidos.
        const dto = {
            type: 'number',
            invalid: ['abc', null, undefined, ' ', 'Infinity'],
        };
        const schema = SchemaBuilder.build(dto);

        // Comportamiento: ningún número real debe ser rechazado
        expect(schema.validate(0).error).toBeUndefined();
        expect(schema.validate(42).error).toBeUndefined();
        expect(schema.validate(-10).error).toBeUndefined();

        // Estructura interna: ningún inválido debe estar registrado en Joi (no debe existir clave invalid)
        const desc = schema.describe();
        expect(desc.invalid).toBeUndefined();
    });

    it('no debería aplicar la restricción invalid cuando el array está vacío', () => {
        // Con el código buggy, `if (dto.invalid)` era truthy para [] y llamaba
        // s.invalid() sin argumentos. El fix devuelve el schema sin modificar cuando
        // el array filtrado queda vacío.
        const dto = { type: 'number', invalid: [] };
        const schema = SchemaBuilder.build(dto);

        expect(schema.validate(0).error).toBeUndefined();
        expect(schema.validate(99).error).toBeUndefined();

        // Estructura interna: ningún inválido numérico debe estar registrado en Joi
        const desc = schema.describe();
        expect(desc.invalid).toBeUndefined();
    });

    it('debería descartar null/undefined del array invalid y aplicar solo los números finitos', () => {
        // Garantiza que un mix de valores válidos e inválidos procesa correctamente
        const dto = {
            type: 'number',
            invalid: [null, undefined, 5, null, 10],
        };
        const schema = SchemaBuilder.build(dto);

        const { error: err5 } = schema.validate(5);
        expect(err5).toBeDefined();
        expect(err5.details[0].type).toBe('any.invalid');

        const { error: err10 } = schema.validate(10);
        expect(err10).toBeDefined();
        expect(err10.details[0].type).toBe('any.invalid');

        // 7 no está en la lista inválida, debe pasar
        expect(schema.validate(7).error).toBeUndefined();
    });

    it('no debería aplicar la restricción valid cuando el array contiene solo valores no numéricos', () => {
        // Simétrico al caso de invalid: con el código buggy, 'abc'/null/undefined
        // se registraban como allow en Joi. Cualquier número que no fuera ese string
        // era rechazado con any.only (Joi trata valid como lista de permitidos exclusivos).
        // Con el fix, el array filtrado queda vacío y .valid() no se invoca.
        const dto = {
            type: 'number',
            valid: ['abc', null, undefined, ''],
        };
        const schema = SchemaBuilder.build(dto);

        // Comportamiento: sin lista valid activa, cualquier número pasa
        expect(schema.validate(1).error).toBeUndefined();
        expect(schema.validate(100).error).toBeUndefined();

        // Estructura interna: no debe activarse flags.only y allow no debe contener 'abc'
        const desc = schema.describe();
        expect(desc.flags?.only).toBeUndefined();
        expect(desc.allow).not.toEqual(expect.arrayContaining(['abc']));
    });

    it('debería aplicar la restricción cuando valid o invalid recibe un número escalar 0', () => {
        const dtoValid = { type: 'number', valid: 0 };
        const schemaValid = SchemaBuilder.build(dtoValid);
        expect(schemaValid.validate(0).error).toBeUndefined();
        expect(schemaValid.validate(1).error).toBeDefined();

        const dtoInvalid = { type: 'number', invalid: 0 };
        const schemaInvalid = SchemaBuilder.build(dtoInvalid);
        expect(schemaInvalid.validate(0).error).toBeDefined();
        expect(schemaInvalid.validate(1).error).toBeUndefined();
    });

    it('debería permitir correctamente un número cuando la lista valid contiene strings', () => {
        const dto = {
            type: 'number',
            valid: ['10', '20'],
        };
        const schema = SchemaBuilder.build(dto);

        const { error: errorNum } = schema.validate(10);
        expect(errorNum).toBeUndefined();

        const { error: errorStr } = schema.validate('20');
        expect(errorStr).toBeUndefined();

        const { error: errorInvalid } = schema.validate(30);
        expect(errorInvalid).toBeDefined();
        expect(errorInvalid.details[0].type).toBe('any.only');
    });

    it.each(['0x1A', '0b101', '0o17', '1e3', 'Infinity', 'abc', ' '])(
        'parseNumber solo reconoce notación decimal finita y preserva %p sin convertir',
        (val) => {
            expect(parseNumber(val)).toBe(val);
        }
    );

    it('no debería perder required cuando precision es un string vacío', () => {
        const dto = {
            type: 'number',
            required: true,
            precision: '',
        };
        const schema = SchemaBuilder.build(dto);
        const { error } = schema.validate(undefined);
        expect(error).toBeDefined();
        expect(error.details[0].type).toBe('any.required');
    });

    it('no debería perder required cuando min contiene un string inválido no numérico', () => {
        const dto = {
            type: 'number',
            required: true,
            min: 'abc',
        };
        const schema = SchemaBuilder.build(dto);
        const { error } = schema.validate(undefined);
        expect(error).toBeDefined();
        expect(error.details[0].type).toBe('any.required');
    });

    it('debería aplicar min correctamente cuando llega como string y no perder required con string vacío', () => {
        const dto = { type: 'number', required: true, min: '10' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        expect(schema.validate(9).error?.details[0].type).toBe('number.min');
        expect(schema.validate(10).error).toBeUndefined();

        const schemaEmpty = SchemaBuilder.build({ type: 'number', required: true, min: '' });
        expect(schemaEmpty.validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it('debería aplicar max correctamente cuando llega como string y no perder required con string vacío', () => {
        const dto = { type: 'number', required: true, max: '20' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        expect(schema.validate(21).error?.details[0].type).toBe('number.max');
        expect(schema.validate(20).error).toBeUndefined();

        const schemaEmpty = SchemaBuilder.build({ type: 'number', required: true, max: '' });
        expect(schemaEmpty.validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it('debería aplicar greater correctamente cuando llega como string y no perder required', () => {
        const dto = { type: 'number', required: true, greater: '5' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        expect(schema.validate(5).error?.details[0].type).toBe('number.greater');
        expect(schema.validate(6).error).toBeUndefined();

        const schemaEmpty = SchemaBuilder.build({ type: 'number', required: true, greater: '' });
        expect(schemaEmpty.validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it('debería aplicar less correctamente cuando llega como string y no perder required', () => {
        const dto = { type: 'number', required: true, less: '5' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        expect(schema.validate(5).error?.details[0].type).toBe('number.less');
        expect(schema.validate(4).error).toBeUndefined();

        const schemaEmpty = SchemaBuilder.build({ type: 'number', required: true, less: '' });
        expect(schemaEmpty.validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it('debería aplicar precision correctamente cuando llega como string y no perder required', () => {
        const dto = { type: 'number', required: true, precision: '2' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        const description = schema.describe();
        expect(description.rules).toEqual(expect.arrayContaining([{ name: 'precision', args: { limit: 2 } }]));
        expect(schema.validate(1.2345).value).toBe(1.23);

        const schemaEmpty = SchemaBuilder.build({ type: 'number', required: true, precision: '' });
        expect(schemaEmpty.validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it('debería aplicar multiple correctamente cuando llega como string y no perder required', () => {
        const dto = { type: 'number', required: true, multiple: '3' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        expect(schema.validate(7).error?.details[0].type).toBe('number.multiple');
        expect(schema.validate(6).error).toBeUndefined();

        const schemaEmpty = SchemaBuilder.build({ type: 'number', required: true, multiple: '' });
        expect(schemaEmpty.validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it.each([0, '0', -1, '-1'])('no debería perder required cuando multiple es inválido (%p)', (multipleVal) => {
        const dto = { type: 'number', required: true, multiple: multipleVal };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it.each([-1, '-1', 'abc', 1.5, '1.5'])(
        'no debería perder required cuando precision es inválido (%p)',
        (precisionVal) => {
            const dto = { type: 'number', required: true, precision: precisionVal };
            const schema = SchemaBuilder.build(dto);
            expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        }
    );

    it('debería coercionarse default a número cuando llega como string numérico', () => {
        const dto = { type: 'number', default: '7' };
        const schema = SchemaBuilder.build(dto);
        const { value } = schema.validate(undefined);
        expect(value).toBe(7);
        expect(typeof value).toBe('number');
    });

    it('debería construir la estructura interna correcta del schema Joi para number con restflow_id', () => {
        const dto = SchemasBuilderMother.numberWithRestflowIdDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description).toMatchObject({
            type: 'string',
            rules: expect.arrayContaining([{ name: 'guid' }]),
        });
    });

    it('debe construir un esquema Joi.date() correctamente con timestamp javascript y fechas convertidas', () => {
        const dto = {
            type: 'date',
            required: true,
            min: '2025-07-01T05:00:00.000Z',
            max: '2025-07-25T05:00:00.000Z',
            default: 'now',
            timestamp: 'javascript',
        };

        const builtSchema = SchemaBuilder.build(dto);

        const expectedSchema = Joi.date()
            .required()
            .timestamp('javascript')
            .min(new Date(dto.min).getTime())
            .max(new Date(dto.max).getTime())
            .default('now');

        const payload = Date.parse('2025-07-10T00:00:00.000Z');

        const resultA = builtSchema.validate(payload);
        const resultB = expectedSchema.validate(payload);

        expect(resultA.error).toBeUndefined();
        expect(resultA.value).toEqual(resultB.value);

        const resultWithDefault = builtSchema.validate(undefined);

        expect(typeof resultWithDefault.value).toBe('number');
    });

    it('debería construir correctamente el schema Joi.date() con timestamp javascript', () => {
        const dto = {
            type: 'date',
            required: true,
            timestamp: 'javascript',
            default: 'now',
            min: '2024-01-01T00:00:00.000Z',
            max: '2026-01-01T00:00:00.000Z',
            greater: '2020-01-01T00:00:00.000Z',
            less: '2030-01-01T00:00:00.000Z',
        };

        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();

        expect(description.type).toBe('date');
        expect(description.flags.presence).toBe('required');
        expect(typeof description.flags.default).toBe('function');

        const ruleMap = Object.fromEntries(description.rules.map((r) => [r.name, r.args.date]));

        expect(ruleMap.greater).toBe('2020-01-01T00:00:00.000Z');
        expect(ruleMap.less).toBe('2030-01-01T00:00:00.000Z');
        expect(ruleMap.min).toBe('2024-01-01T00:00:00.000Z');
        expect(ruleMap.max).toBe('2026-01-01T00:00:00.000Z');
    });

    it('debería construir correctamente el schema Joi.date() con formato ISO', () => {
        const dto = {
            type: 'date',
            required: true,
            iso: true,
            default: 'now',
            min: '2024-01-01T00:00:00.000Z',
            max: '2026-01-01T00:00:00.000Z',
            greater: '2020-01-01T00:00:00.000Z',
            less: '2030-01-01T00:00:00.000Z',
        };

        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();

        expect(description.type).toBe('date');
        expect(description.flags.presence).toBe('required');
        expect(typeof description.flags.default).toBe('function');

        const ruleMap = Object.fromEntries(description.rules.map((r) => [r.name, r.args.date]));

        expect(ruleMap.greater).toBe('2020-01-01T00:00:00.000Z');
        expect(ruleMap.less).toBe('2030-01-01T00:00:00.000Z');
        expect(ruleMap.min).toBe('2024-01-01T00:00:00.000Z');
        expect(ruleMap.max).toBe('2026-01-01T00:00:00.000Z');
    });

    it('debería construir correctamente un schema Joi.date() sin valores por defecto', () => {
        const dto = {
            type: 'date',
            required: false,
        };

        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();

        expect(description.type).toBe('date');
        expect(description.flags?.default).toBeUndefined();
        expect(description.rules).toBeUndefined();
    });

    it('debería construir la estructura interna correcta del schema Joi para date con restflow_id', () => {
        const dto = SchemasBuilderMother.dateWithRestflowIdDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description).toMatchObject({
            type: 'string',
            rules: expect.arrayContaining([{ name: 'guid' }]),
        });
    });

    it('no debería perder required cuando min, max, greater o less contienen fechas inválidas', () => {
        const dtoMin = { type: 'date', required: true, min: 'invalid-date' };
        expect(SchemaBuilder.build(dtoMin).validate(undefined).error?.details[0].type).toBe('any.required');

        const dtoMax = { type: 'date', required: true, max: 'invalid-date' };
        expect(SchemaBuilder.build(dtoMax).validate(undefined).error?.details[0].type).toBe('any.required');

        const dtoGreater = { type: 'date', required: true, greater: 'invalid-date' };
        expect(SchemaBuilder.build(dtoGreater).validate(undefined).error?.details[0].type).toBe('any.required');

        const dtoLess = { type: 'date', required: true, less: 'invalid-date' };
        expect(SchemaBuilder.build(dtoLess).validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it('no debería perder required en date cuando default contiene un valor inválido', () => {
        const dto = { type: 'date', required: true, default: 'invalid-default-date' };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
    });

    it('debería construir la estructura interna correcta del schema Joi para boolean', () => {
        const dto = SchemasBuilderMother.booleanDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description).toMatchObject({
            type: 'boolean',
            flags: { presence: 'required', default: false },
        });
        expect(description.truthy).toEqual(expect.arrayContaining([1, 'yes', 'true']));
        expect(description.falsy).toEqual(expect.arrayContaining([0, 'no', 'false']));
    });

    it('debería construir la estructura interna correcta del schema Joi para boolean con restflow_id', () => {
        const dto = SchemasBuilderMother.booleanWithRestflowIdDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description).toMatchObject({
            type: 'string',
            rules: expect.arrayContaining([{ name: 'guid' }]),
        });
    });

    it('debería preservar required en boolean cuando restflow_id está presente', () => {
        const dto = {
            type: 'boolean',
            required: true,
            restflow_id: '550e8400-e29b-41d4-a716-446655440000',
        };
        const schema = SchemaBuilder.build(dto);
        expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        expect(schema.validate('550e8400-e29b-41d4-a716-446655440000').error).toBeUndefined();
    });

    it('debería construir la estructura interna correcta del schema Joi para object', () => {
        const dto = SchemasBuilderMother.objectDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description.type).toBe('object');
        expect(Object.keys(description.keys)).toEqual(expect.arrayContaining(['name', 'age', 'isActive', 'address']));
        expect(description.keys.name.type).toBe('string');
        expect(description.keys.age.type).toBe('number');
        expect(description.keys.isActive.type).toBe('boolean');
        expect(description.keys.address.type).toBe('object');
        expect(Object.keys(description.keys.address.keys)).toEqual(expect.arrayContaining(['street', 'number']));
        expect(description.keys.address.keys.street.type).toBe('string');
        expect(description.keys.address.keys.number.type).toBe('number');
    });

    it('debería construir la estructura interna correcta del schema Joi para array', () => {
        const dto = SchemasBuilderMother.arrayDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();
        expect(description.type).toBe('array');
        if (description.items && Array.isArray(description.items) && description.items[0]) {
            expect(description.items[0].type).toBeDefined();
        }
    });

    it('debería fallar con mensaje de requerido si un array obligatorio está vacío', () => {
        const dto = SchemasBuilderMother.arrayDto();
        const schema = SchemaBuilder.build(dto);
        const { error } = schema.validate([]);
        expect(error).toBeDefined();
        const detail = error.details[0];
        expect(detail.type).toBe('array.min');
        expect(detail.message).toBe('required');
    });

    it('debería tratar un array marcado required como opcional cuando ui.is_visible es false', () => {
        const dto = {
            titulo: { type: 'string', required: true },
            filas: {
                type: 'array',
                required: true,
                ui: { is_visible: false },
                data_structure: {
                    id: { type: 'string', required: true },
                },
            },
        };
        const schema = SchemaBuilder.build(dto);
        const { error } = schema.validate({ titulo: 'ok' });
        expect(error).toBeUndefined();
    });

    it('debería construir correctamente un esquema Joi para un DTO deeplyNested', () => {
        const dto = SchemasBuilderMother.deeplyNestedDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();

        expect(description.type).toBe('object');

        expect(description.keys.mcc.type).toBe('number');
        expect(description.keys.ciiu.type).toBe('number');
        expect(description.keys.otro.type).toBe('string');
        expect(description.keys.email.type).toBe('string');
        expect(description.keys.causal.type).toBe('string');
        expect(description.keys.ciudad.type).toBe('string');
        expect(description.keys.cuenta_1.type).toBe('number');
        expect(description.keys.tasa_amex.type).toBe('number');
        expect(description.keys.tasa_visa.type).toBe('number');
        expect(description.keys.tipo_abono.type).toBe('string');
        expect(description.keys.puntos_de_venta.type).toBe('array');
        expect(description.keys.dataGridAppointments.type).toBe('array');
        expect(description.keys.documentos_para_estudio.type).toBe('object');

        const puntosDeVentaItems = description.keys.puntos_de_venta.items[0].keys;
        expect(puntosDeVentaItems.cuenta_bancaria.type).toBe('number');
        expect(puntosDeVentaItems.direccion_punto_venta.type).toBe('string');
        expect(puntosDeVentaItems.rva_tipo_cuenta_bancaria.type).toBe('string');

        const dataGridAppointmentsItems = description.keys.dataGridAppointments.items[0].keys;
        expect(dataGridAppointmentsItems.id.type).toBe('string');
        expect(dataGridAppointmentsItems.date.type).toBe('date');
        expect(dataGridAppointmentsItems.barrio.type).toBe('string');
        expect(dataGridAppointmentsItems.franja.type).toBe('string');
        expect(dataGridAppointmentsItems.ksubmit.type).toBe('boolean');
        expect(dataGridAppointmentsItems.direccion.type).toBe('string');
        expect(dataGridAppointmentsItems.punto_referencia.type).toBe('string');

        const docs = description.keys.documentos_para_estudio.keys;
        expect(docs.RUT.type).toBe('boolean');
        expect(docs['Camara de comercio'].type).toBe('boolean');
        expect(docs['Documento de identidad'].type).toBe('boolean');
        expect(docs['Registro fotografico eagle fachada'].type).toBe('boolean');
        expect(docs['Formato de vinculacion adquirencia fotografico'].type).toBe('boolean');
    });

    it('debería construir correctamente un esquema Joi para un DTO complejo', () => {
        const dto = SchemasBuilderMother.complexDto();
        const schema = SchemaBuilder.build(dto);
        const description = schema.describe();

        expect(description.type).toBe('object');

        const dtoKeys = Object.keys(dto);
        expect(Object.keys(description.keys)).toEqual(expect.arrayContaining(dtoKeys));

        for (const key of dtoKeys) {
            if (!dto[key].type) continue;
            expect(description.keys[key].type).toBe(
                dto[key].type === 'boolean'
                    ? 'boolean'
                    : dto[key].type === 'number'
                      ? 'number'
                      : dto[key].type === 'date'
                        ? 'date'
                        : 'string'
            );
        }
    });

    it('Valida correctamente la estructura de un ejemplo de auxuliar proveedores', () => {
        const dto = SchemasBuilderMother.exampleProviderAuxSchema();

        const builtSchema = SchemaBuilder.build(dto);

        const payload = {
            edad: 9,
            nombre: 'provider1',
            progreso: {
                inicio: true,
            },
            contactos: [
                {
                    nombre: 'contact1',
                    telefono: '64564',
                },
            ],
            constituido: true,
        };

        const result = builtSchema.validate(payload);

        expect(result.error).toBeUndefined();
        expect(result.value).toBeDefined();
    });

    it('Falla si el payload tiene una propiedad adicional no permitida', () => {
        const dto = SchemasBuilderMother.exampleProviderAuxSchema();
        const builtSchema = SchemaBuilder.build(dto);

        const payload = {
            edad: 9,
            nombre: 'provider1',
            progreso: {
                inicio: true,
            },
            contactos: [
                {
                    nombre: 'contact1',
                    telefono: '64564',
                },
            ],
            constituido: true,
            extraPropiedad: 'no permitida',
        };

        const result = builtSchema.validate(payload);

        expect(result.error).toBeDefined();
    });

    it('Falla si alguna propiedad tiene un tipo incorrecto', () => {
        const dto = SchemasBuilderMother.exampleProviderAuxSchema();
        const builtSchema = SchemaBuilder.build(dto);

        const payload = {
            edad: 'nueve',
            nombre: 'provider1',
            progreso: {
                inicio: true,
            },
            contactos: [
                {
                    nombre: 'contact1',
                    telefono: '64564',
                },
            ],
            constituido: true,
        };

        const result = builtSchema.validate(payload);

        expect(result.error).toBeDefined();
    });

    it('debería continuar correctamente cuando el tipo es "calculate" sin arrojar error', () => {
        const dto = SchemasBuilderMother.calculateDto();

        const schema = SchemaBuilder.build(dto);

        const description = schema.describe();
        expect(description.type).toBe('any');

        const valuesToTest = ['texto', 123, true, null, { a: 1 }, [1, 2, 3]];
        for (const value of valuesToTest) {
            const { error } = schema.validate(value);
            expect(error).toBeUndefined();
        }
    });

    describe('SchemaBuilder - Empty field validation', () => {
        it('debería permitir strings vacíos cuando empty está configurado como true', () => {
            const dto = SchemasBuilderMother.stringDto({ empty: true, required: false });

            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate('');

            expect(error).toBeUndefined();
            expect(value).toBe('');
        });

        it('debería rechazar strings vacíos cuando empty está configurado como false', () => {
            const dto = SchemasBuilderMother.stringDto({ empty: false, required: true });

            const schema = SchemaBuilder.build(dto);
            const { error } = schema.validate('');

            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('"value" contains an invalid value');
        });

        it('debería validar correctamente un objeto complejo con campos vacíos permitidos', () => {
            const dto = {
                type: 'object',
                required: true,
                data_structure: {
                    Marca: {
                        type: 'string',
                        empty: true,
                        required: false,
                    },
                    ccNitTomador: {
                        type: 'string',
                        empty: true,
                        required: false,
                    },
                    NombreCliente: {
                        type: 'string',
                        empty: false,
                        required: true,
                    },
                    NumeroPoliza: {
                        type: 'number',
                        required: true,
                    },
                },
            };

            const schema = SchemaBuilder.build(dto);

            const validPayload = {
                Marca: '',
                ccNitTomador: '',
                NombreCliente: 'Cliente Test',
                NumeroPoliza: 123456789,
            };

            const { error: validError } = schema.validate(validPayload);
            expect(validError).toBeUndefined();
        });

        it('debería fallar cuando un campo requerido sin empty permitido está vacío', () => {
            const dto = SchemasBuilderMother.mixedEmptyFieldsDto();

            const schema = SchemaBuilder.build(dto);

            const invalidPayload = {
                campoOpcionalVacio: '',
                campoRequeridoNoVacio: '',
            };

            const { error } = schema.validate(invalidPayload);
            expect(error).toBeDefined();
            expect(error.details[0].path).toContain('campoRequeridoNoVacio');
            expect(error.details[0].message).toContain('"campoRequeridoNoVacio" contains an invalid value');
        });

        it('debería manejar correctamente el caso real del form_indemnizacion', () => {
            const dto = {
                type: 'object',
                required: true,
                data_structure: {
                    form_indemnizacion: {
                        type: 'object',
                        required: true,
                        data_structure: {
                            Marca: {
                                type: 'string',
                                empty: true,
                                required: false,
                            },
                            ccNitTomador: {
                                type: 'string',
                                empty: true,
                                required: false,
                            },
                            NombreCliente: {
                                type: 'string',
                                empty: false,
                                required: true,
                            },
                            NumeroPoliza: {
                                type: 'number',
                                required: true,
                            },
                            CelularCliente: {
                                type: 'number',
                                required: true,
                            },
                        },
                    },
                },
            };

            const schema = SchemaBuilder.build(dto);

            const testPayload = {
                form_indemnizacion: {
                    Marca: '',
                    ccNitTomador: '',
                    NombreCliente: 'aaaaaaaaaaaaaa',
                    NumeroPoliza: 111111111111,
                    CelularCliente: 3215646464,
                },
            };

            const { error } = schema.validate(testPayload);
            expect(error).toBeUndefined();
        });

        it('debería construir correctamente la estructura interna para string con empty=true', () => {
            const dto = SchemasBuilderMother.stringDto({ empty: true, required: false });

            const schema = SchemaBuilder.build(dto);
            const description = schema.describe();

            expect(description.type).toBe('string');
            expect(description.allow).toEqual(expect.arrayContaining(['']));
        });

        it('debería construir correctamente la estructura interna para string con empty=false', () => {
            const dto = SchemasBuilderMother.stringDto({ empty: false, required: true });

            const schema = SchemaBuilder.build(dto);
            const description = schema.describe();

            expect(description.type).toBe('string');
            expect(description.flags.presence).toBe('required');
            expect(description.allow).not.toEqual(expect.arrayContaining(['']));
        });
    });

    describe('SchemaBuilder - Number validation conflicts', () => {
        it('debería manejar correctamente cuando positive y negative están ambos en true', () => {
            const dto = {
                type: 'number',
                unsafe: false,
                integer: false,
                negative: true,
                positive: true,
                required: false,
            };

            const schema = SchemaBuilder.build(dto);

            const { error: positiveError } = schema.validate(5);
            expect(positiveError).toBeUndefined();

            const { error: negativeError } = schema.validate(-5);
            expect(negativeError).toBeUndefined();

            const { error: zeroError } = schema.validate(0);
            expect(zeroError).toBeUndefined();
        });

        it('debería aplicar solo positive cuando positive es true y negative es false', () => {
            const dto = {
                type: 'number',
                positive: true,
                negative: false,
                required: false,
            };

            const schema = SchemaBuilder.build(dto);

            const { error: positiveError } = schema.validate(5);
            expect(positiveError).toBeUndefined();

            const { error: negativeError } = schema.validate(-5);
            expect(negativeError).toBeDefined();
        });

        it('debería aplicar solo negative cuando negative es true y positive es false', () => {
            const dto = {
                type: 'number',
                positive: false,
                negative: true,
                required: false,
            };

            const schema = SchemaBuilder.build(dto);

            const { error: negativeError } = schema.validate(-5);
            expect(negativeError).toBeUndefined();

            const { error: positiveError } = schema.validate(5);
            expect(positiveError).toBeDefined();
        });

        it('debe permitir hacer validaciones internas de cada sub formulario asociado', () => {
            const dto = SchemasBuilderMother.realCaseAuxDto();
            const schema = SchemaBuilder.build(dto);
            const data = {
                prueba_dm: {
                    fecha_solicitud: '2025-12-25T00:00:00-05:00',
                    telefono: 3124,
                },
            };

            const { error } = schema.validate(data, {
                abortEarly: false,
            });

            const stateRequired = error.details.some((detail) => detail.path.includes('estado'));

            expect(stateRequired).toBe(true);
        });

        it('No permite campos vacios en campos requeridos', () => {
            const dto = SchemasBuilderMother.realCaseAuxDto();
            const schema = SchemaBuilder.build(dto);
            const data = {
                asistencia: {
                    clase: '',
                    linea: '',
                    placa: '',
                    servicio: '',
                },
            };

            const result = schema.validate(data, {
                abortEarly: false,
            });

            console.log('error', result);

            // const classNotEmpty = error.details.some((detail) => detail.path.includes('clase'));
            // const lineNotEmpty = error.details.some((detail) => detail.path.includes('linea'));
            // const placaOK = error.details.filter((detail) => detail.path.includes('placa'));
            // const servicioOK = error.details.filter((detail) => detail.path.includes('servicio'));

            // expect(classNotEmpty).toBe(true);
            // expect(lineNotEmpty).toBe(true);
            // expect(placaOK.length).toBe(0);
            // expect(servicioOK.length).toBe(0);
        });
    });

    describe('DateSchemaBuilder - timezoneFormat=withTimezone', () => {
        it('debería aceptar fecha con timezone Z', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto();
            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate('2025-12-25T10:30:00Z');

            expect(error).toBeUndefined();
            expect(value).toBe('2025-12-25T10:30:00Z');
        });

        it('debería aceptar fecha con offset timezone (-05:00)', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto();
            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate('2025-12-25T10:30:00-05:00');

            expect(error).toBeUndefined();
            expect(value).toBe('2025-12-25T10:30:00-05:00');
        });

        it('debería aceptar fecha con offset timezone positivo (+02:00)', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto();
            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate('2025-12-25T10:30:00+02:00');

            expect(error).toBeUndefined();
            expect(value).toBe('2025-12-25T10:30:00+02:00');
        });

        it('debería aceptar fecha con milisegundos y timezone Z', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto();
            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate('2025-12-25T10:30:00.000Z');

            expect(error).toBeUndefined();
            expect(value).toBe('2025-12-25T10:30:00.000Z');
        });

        it('debería rechazar fecha sin timezone', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto();
            const schema = SchemaBuilder.build(dto);
            const { error } = schema.validate('2025-12-25T10:30:00');

            expect(error).toBeDefined();
        });

        it('debería rechazar formato de fecha inválido', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto();
            const schema = SchemaBuilder.build(dto);
            const { error } = schema.validate('2025-12-25');

            expect(error).toBeDefined();
        });

        it('debería convertir a timestamp javascript cuando timestamp=javascript', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredAndTimestampDto();
            const schema = SchemaBuilder.build(dto);
            const input = '2025-12-25T10:30:00-05:00';
            const { error, value } = schema.validate(input);

            expect(error).toBeUndefined();
            expect(typeof value).toBe('number');
            expect(value).toBe(new Date(input).getTime());
        });

        it('debería convertir a timestamp unix cuando timestamp=unix', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredAndTimestampDto({ timestamp: 'unix' });
            const schema = SchemaBuilder.build(dto);
            const input = '2025-12-25T10:30:00Z';
            const { error, value } = schema.validate(input);

            expect(error).toBeUndefined();
            expect(typeof value).toBe('number');
            expect(value).toBe(Math.floor(new Date(input).getTime() / 1000));
        });

        it('debería generar default "now" como timestamp javascript', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredAndTimestampDto({
                required: false,
                default: 'now',
            });
            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate(undefined);

            expect(error).toBeUndefined();
            expect(typeof value).toBe('number');
            expect(value).toBeGreaterThan(0);
        });

        it('debería generar default "now" como ISO string cuando no hay timestamp', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto({
                required: false,
                default: 'now',
            });
            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate(undefined);

            expect(error).toBeUndefined();
            expect(typeof value).toBe('string');
            expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('debería validar constraint min correctamente', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto({
                min: '2025-06-01T00:00:00Z',
            });
            const schema = SchemaBuilder.build(dto);

            const { error: validError } = schema.validate('2025-06-15T12:00:00Z');
            expect(validError).toBeUndefined();

            const { error: invalidError } = schema.validate('2025-05-31T23:59:59Z');
            expect(invalidError).toBeDefined();
        });

        it('debería validar constraint max correctamente', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto({
                max: '2025-12-31T23:59:59Z',
            });
            const schema = SchemaBuilder.build(dto);

            const { error: validError } = schema.validate('2025-06-15T12:00:00Z');
            expect(validError).toBeUndefined();

            const { error: invalidError } = schema.validate('2026-01-01T00:00:00Z');
            expect(invalidError).toBeDefined();
        });

        it('debería validar constraint greater correctamente', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto({
                greater: '2025-01-01T00:00:00Z',
            });
            const schema = SchemaBuilder.build(dto);

            const { error: validError } = schema.validate('2025-06-15T12:00:00Z');
            expect(validError).toBeUndefined();

            const { error: invalidError } = schema.validate('2025-01-01T00:00:00Z');
            expect(invalidError).toBeDefined();
        });

        it('debería validar constraint less correctamente', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto({
                less: '2026-01-01T00:00:00Z',
            });
            const schema = SchemaBuilder.build(dto);

            const { error: validError } = schema.validate('2025-06-15T12:00:00Z');
            expect(validError).toBeUndefined();

            const { error: invalidError } = schema.validate('2026-01-01T00:00:00Z');
            expect(invalidError).toBeDefined();
        });

        it('debería retornar string uuid cuando restflow_id está presente', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto({
                restflow_id: '550e8400-e29b-41d4-a716-446655440000',
            });
            const schema = SchemaBuilder.build(dto);
            const description = schema.describe();
            expect(description.type).toBe('string');
            expect(description.rules).toEqual(expect.arrayContaining([{ name: 'guid' }]));
        });

        it('debería preservar required en date withTimezone aún con constraints o defaults inválidos', () => {
            const dto = SchemasBuilderMother.dateWithTimezoneRequiredDto({
                required: true,
                default: 'not-valid',
                min: 'not-a-date',
            });
            const schema = SchemaBuilder.build(dto);
            expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        });
    });

    describe('DateSchemaBuilder - timezoneFormat=withoutTimezone', () => {
        it('debería agregar timezone del schema a fecha sin timezone', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto();
            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate('2025-12-25T10:30:00');

            expect(error).toBeUndefined();
            expect(typeof value).toBe('string');
            expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('debería rechazar fecha con timezone cuando timezoneFormat=withoutTimezone', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto();
            const schema = SchemaBuilder.build(dto);
            const { error } = schema.validate('2025-12-25T10:30:00Z');

            expect(error).toBeDefined();
        });

        it('debería rechazar fecha con offset cuando timezoneFormat=withoutTimezone', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto();
            const schema = SchemaBuilder.build(dto);
            const { error } = schema.validate('2025-12-25T10:30:00-05:00');

            expect(error).toBeDefined();
        });

        it('debería rechazar formato de fecha inválido', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto();
            const schema = SchemaBuilder.build(dto);
            const { error } = schema.validate('2025-12-25');

            expect(error).toBeDefined();
        });

        it('debería generar default "now" con timezone del schema', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto({
                required: false,
                default: 'now',
            });
            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate(undefined);

            expect(error).toBeUndefined();
            expect(typeof value).toBe('string');
            expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('debería validar constraint min correctamente', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto({
                min: '2025-06-01T00:00:00-05:00',
            });
            const schema = SchemaBuilder.build(dto);

            const { error: validError } = schema.validate('2025-06-15T12:00:00');
            expect(validError).toBeUndefined();

            const { error: invalidError } = schema.validate('2025-05-31T23:59:59');
            expect(invalidError).toBeDefined();
        });

        it('debería validar constraint max correctamente', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto({
                max: '2025-12-31T23:59:59-05:00',
            });
            const schema = SchemaBuilder.build(dto);

            const { error: validError } = schema.validate('2025-06-15T12:00:00');
            expect(validError).toBeUndefined();

            const { error: invalidError } = schema.validate('2026-01-01T00:00:00');
            expect(invalidError).toBeDefined();
        });

        it('debería aceptar fecha con milisegundos sin timezone', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto();
            const schema = SchemaBuilder.build(dto);
            const { error, value } = schema.validate('2025-12-25T10:30:00.000');

            expect(error).toBeUndefined();
            expect(typeof value).toBe('string');
        });

        it('debería retornar string uuid cuando restflow_id está presente', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto({
                restflow_id: '550e8400-e29b-41d4-a716-446655440000',
            });
            const schema = SchemaBuilder.build(dto);
            const description = schema.describe();
            expect(description.type).toBe('string');
            expect(description.rules).toEqual(expect.arrayContaining([{ name: 'guid' }]));
        });

        it('debería preservar required en date withoutTimezone aún con constraints o defaults inválidos', () => {
            const dto = SchemasBuilderMother.dateWithoutTimezoneInInputDto({
                required: true,
                default: 'not-valid',
                min: 'not-a-date',
            });
            const schema = SchemaBuilder.build(dto);
            expect(schema.validate(undefined).error?.details[0].type).toBe('any.required');
        });
    });

    describe('SchemaBuilder.leafAccepts', () => {
        it('sin dependsOn: valida el valor contra el esquema de la hoja', () => {
            const dto = { type: 'string', required: false, trim: true, uppercase: true };

            expect(SchemaBuilder.leafAccepts(dto, 'HOLA')).toBe(true);
            expect(SchemaBuilder.leafAccepts(dto, 123)).toBe(false);
        });

        it('con dependsOn satisfecho: valida contra un objeto sintético que incluye al hermano', () => {
            const dto = {
                type: 'string',
                required: false,
                trim: true,
                uppercase: true,
                dependency: true,
                dependsOn: 'requiereMotivo',
            };

            const accepted = SchemaBuilder.leafAccepts(dto, 'CAMBIO DE HORARIO', {
                key: 'motivo',
                siblings: { requiereMotivo: true, motivo: '  cambio de horario  ' },
            });

            expect(accepted).toBe(true);
        });

        it('con dependsOn NO satisfecho: el campo queda inactivo y cualquier valor pasa', () => {
            const dto = { type: 'string', required: true, dependency: true, dependsOn: 'requiereMotivo' };

            const accepted = SchemaBuilder.leafAccepts(dto, 'lo que sea', {
                key: 'motivo',
                siblings: { requiereMotivo: false },
            });

            expect(accepted).toBe(true);
        });

        it('resuelve la referencia sin lanzar "Invalid reference exceeds the schema root"', () => {
            const dto = {
                type: 'string',
                required: false,
                trim: true,
                uppercase: true,
                dependency: true,
                dependsOn: 'requiereMotivo',
            };

            expect(() =>
                SchemaBuilder.leafAccepts(dto, 'X', { key: 'motivo', siblings: { requiereMotivo: true } })
            ).not.toThrow();
        });

        it('dependencyValueValidation con valor que no coincide: no lanza y trata el campo como inactivo', () => {
            const dto = {
                type: 'string',
                required: false,
                dependency: true,
                dependsOn: 'tipo',
                dependencyValueValidation: true,
                dependencyValue: 'especial',
            };

            expect(() =>
                SchemaBuilder.leafAccepts(dto, 'cualquier-valor', { key: 'motivo', siblings: { tipo: 'normal' } })
            ).not.toThrow();
            expect(
                SchemaBuilder.leafAccepts(dto, 'cualquier-valor', { key: 'motivo', siblings: { tipo: 'normal' } })
            ).toBe(true);
        });

        it('key === dependsOn (config absurda pero posible): no rompe', () => {
            const dto = { type: 'string', required: false, dependency: true, dependsOn: 'motivo' };

            expect(() =>
                SchemaBuilder.leafAccepts(dto, 'X', { key: 'motivo', siblings: { motivo: 'X' } })
            ).not.toThrow();
        });

        it('dependsOn ausente en siblings: no lanza', () => {
            const dto = { type: 'string', required: false, dependency: true, dependsOn: 'requiereMotivo' };

            expect(() => SchemaBuilder.leafAccepts(dto, 'X', { key: 'motivo', siblings: {} })).not.toThrow();
        });

        it('devuelve false cuando el tipo no se puede construir', () => {
            expect(SchemaBuilder.leafAccepts({ type: 'unsupported' }, 'x')).toBe(false);
        });

        it('memoiza el esquema de la hoja por referencia del dto', () => {
            const dto = { type: 'string', trim: true };
            const buildSpy = jest.spyOn(SchemaBuilder, '_buildSingle');

            SchemaBuilder.leafAccepts(dto, 'a');
            SchemaBuilder.leafAccepts(dto, 'b');

            expect(buildSpy).toHaveBeenCalledTimes(1);
            buildSpy.mockRestore();
        });
    });

    describe('memoization', () => {
        it('reutiliza la misma instancia Joi para estructuras idénticas (por contenido, no por referencia)', () => {
            const a = { campo1: { type: 'string', required: true } };
            const b = { campo1: { type: 'string', required: true } };

            const first = SchemaBuilder.build(a);
            const second = SchemaBuilder.build(b);

            expect(second).toBe(first);
        });

        it('devuelve instancias distintas para estructuras distintas', () => {
            const first = SchemaBuilder.build({ campo1: { type: 'string', required: true } });
            const second = SchemaBuilder.build({ campo1: { type: 'number', required: true } });

            expect(second).not.toBe(first);
        });

        it('preserva la validación tras el cache hit', () => {
            const structure = { edad: { type: 'number', required: true, min: 0 } };

            SchemaBuilder.build(structure);
            const cached = SchemaBuilder.build({ edad: { type: 'number', required: true, min: 0 } });

            expect(cached.validate({ edad: 5 }).error).toBeUndefined();
            expect(cached.validate({ edad: -1 }).error).toBeDefined();
            expect(cached.validate({}).error).toBeDefined();
        });
    });
});
