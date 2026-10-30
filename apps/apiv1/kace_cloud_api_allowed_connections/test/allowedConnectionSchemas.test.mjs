import {
    AllowedConnectionCreateSchema,
    AllowedConnectionForm,
    AllowedConnectionUpdateSchema,
} from '../src/AllowedConnectionSchemas.mjs';

const schemaCases = [
    ['create', AllowedConnectionCreateSchema, { id: 'c582021e-7739-4542-974a-ff26166270a1' }],
    ['update', AllowedConnectionUpdateSchema, {}],
    ['form', AllowedConnectionForm, { description: 'Facebook test', connection: 'facebook.com' }],
];

describe.each(schemaCases)('%s allowed-connection schema', (_name, schema, requiredFields) => {
    it.each([true, 1])('rejects a blank certificate when HTTPS is enabled with %p', (hasSsl) => {
        const { error } = schema.validate({
            ...requiredFields,
            has_ssl: hasSsl,
            certificate: '',
        });

        expect(error?.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ['certificate'],
                    type: 'string.empty',
                }),
            ])
        );
    });

    it.each([false, 0])('allows a blank certificate when HTTPS is disabled with %p', (hasSsl) => {
        const { error, value } = schema.validate({
            ...requiredFields,
            has_ssl: hasSsl,
            certificate: '',
        });

        expect(error).toBeUndefined();
        expect(value.certificate).toBe('');
    });

    it.each([false, 0])('rejects a fingerprint when HTTPS is disabled with %p', (hasSsl) => {
        const { error } = schema.validate({
            ...requiredFields,
            has_ssl: hasSsl,
            certificate: '12341234',
        });

        expect(error?.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ['certificate'],
                    type: 'any.only',
                }),
            ])
        );
    });

    it('rejects a blank certificate when the HTTPS state is omitted', () => {
        const { error } = schema.validate({
            ...requiredFields,
            certificate: '',
        });

        expect(error?.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ['certificate'],
                    type: 'string.empty',
                }),
            ])
        );
    });

    it('allows certificate to be omitted from a partial payload', () => {
        const { error } = schema.validate(requiredFields);

        expect(error).toBeUndefined();
    });
});
