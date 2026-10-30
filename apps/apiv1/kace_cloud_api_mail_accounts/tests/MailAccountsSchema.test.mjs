import { MailAccountsCreateSchema, MailAccountsUpdateSchema } from '../src/MailAccountsSchema.mjs';

const VALID_SMTP_PAYLOAD = {
    type: 'smtp',
    description: 'Support mailbox',
    host: 'smtp.example.com',
    port: 587,
    protocol: 'smtp',
    username: 'support@example.com',
    password: 'secret',
};

describe('MailAccountsSchema Channel Hub registration compatibility', () => {
    it('keeps an omitted Channel Hub registration field absent on update', () => {
        const { error, value } = MailAccountsUpdateSchema.validate({
            ...VALID_SMTP_PAYLOAD,
            description: 'Updated mailbox',
        });

        expect(error).toBeUndefined();
        expect(value).not.toHaveProperty('register_in_channel_hub');
    });

    it('retains the false default for create API clients', () => {
        const { error, value } = MailAccountsCreateSchema.validate({
            ...VALID_SMTP_PAYLOAD,
            id: '11111111-1111-4111-8111-111111111111',
        });

        expect(error).toBeUndefined();
        expect(value.register_in_channel_hub).toBe(false);
    });

    it('continues accepting explicit registration values from external clients', () => {
        const { error, value } = MailAccountsUpdateSchema.validate({
            ...VALID_SMTP_PAYLOAD,
            register_in_channel_hub: true,
        });

        expect(error).toBeUndefined();
        expect(value.register_in_channel_hub).toBe(true);
    });
});
