import { ValueObjectEmail } from '../../src/templates/domain/value-object/ValueObjectEmail.js';

describe('ValueObjectEmail Tests', () => {
    it('should accept a valid email', () => {
        const value = 'valid@example.com';
        const email = new ValueObjectEmail('email', value);
        expect(email.value).toBe(value);
    });

    it('should throw an error for invalid email format', () => {
        const value = 'invalid-email';
        expect(() => new ValueObjectEmail('email', value)).toThrowError('email: Invalid value for object email');
    });

    it('should accept multiple concatenated valid emails', () => {
        const value = 'one@example.com,two@example.com';
        const email = new ValueObjectEmail('email', value);
        expect(email.value).toBe(value);
    });

    it('should accept null value if nullable is true', () => {
        const value = null;
        const email = new ValueObjectEmail('email', value, true);
        expect(email.value).toBeNull();
    });

    it('should throw if null and nullable is false', () => {
        expect(() => new ValueObjectEmail('email', null, false)).toThrowError('The value cannot be null');
    });

    it('should accept multiple template parameters', () => {
        const value = '{{user_email}},{{client.email}},{{admin_email}}';
        const email = new ValueObjectEmail('email', value);
        expect(email.value).toBe(value);
    });

    it('should accept combination of valid email and template parameter', () => {
        const value = 'admin@example.com,test@example.com,{{user_email}}';
        const email = new ValueObjectEmail('email', value);
        expect(email.value).toBe(value);
    });
});
