import { randomUUID as uuidv4 } from 'node:crypto';
import { OneScriptCreateSchema, OneScriptUpdateSchema } from '../src/OneScriptSchema.mjs';

const validPayload = () => ({
    name: 'Integración de prueba',
    url: 'https://onescript.example.com',
    url_api: 'https://api.example.com',
    onescript_reference_id: uuidv4(),
});

const referenceIdErrorType = (schema, payload) =>
    schema.validate(payload).error?.details.find((detail) => detail.path[0] === 'onescript_reference_id')?.type;

describe.each([
    ['OneScriptCreateSchema', OneScriptCreateSchema, () => ({ ...validPayload(), id: uuidv4() })],
    ['OneScriptUpdateSchema', OneScriptUpdateSchema, validPayload],
])('%s onescript_reference_id', (_name, schema, buildPayload) => {
    it('accepts a valid OneScript form ID', () => {
        expect(schema.validate(buildPayload()).error).toBeUndefined();
    });

    it.each([
        ['null', null, 'string.base'],
        ['an empty string', '', 'string.empty'],
        ['a non-UUID value', 'form-123', 'string.guid'],
    ])('rejects %s as OneScript form ID', (_label, value, expectedType) => {
        expect(referenceIdErrorType(schema, { ...buildPayload(), onescript_reference_id: value })).toBe(expectedType);
    });
});

describe('OneScriptCreateSchema onescript_reference_id presence', () => {
    it('rejects a payload without the OneScript form ID', () => {
        const { onescript_reference_id: _omitted, ...payload } = validPayload();

        expect(referenceIdErrorType(OneScriptCreateSchema, { ...payload, id: uuidv4() })).toBe('any.required');
    });
});

describe('OneScriptUpdateSchema partial update', () => {
    it('accepts a partial update that omits the OneScript form ID', () => {
        expect(OneScriptUpdateSchema.validate({ name: 'Solo cambia el nombre' }).error).toBeUndefined();
    });
});
