import { ValueObjectEmail } from '../../../../src/shared/index.js';

describe('ValueObjectEmail', () => {
    it('should create an instance with a valid email', () => {
        const value = 'test@example.com';
        const valueObject = new ValueObjectEmail('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error for an invalid email', () => {
        const value = 'invalid-email';
        expect(() => new ValueObjectEmail('TestVO', value)).toThrowError('Invalid value for object email');
    });

    it('should create an instance with a null value if nullable is true', () => {
        const value = null;
        const valueObject = new ValueObjectEmail('TestVO', value, true);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const value = null;
        expect(() => new ValueObjectEmail('TestVO', value, false)).toThrowError('The value cannot be null');
    });

    it('should throw an error for an email with spaces', () => {
        const value = 'test @example.com';
        expect(() => new ValueObjectEmail('TestVO', value)).toThrowError('Invalid value for object email');
    });

    it('should throw an error for an email without a domain', () => {
        const value = 'test@';
        expect(() => new ValueObjectEmail('TestVO', value)).toThrowError('Invalid value for object email');
    });

    it('should throw an error for an email without a username', () => {
        const value = '@example.com';
        expect(() => new ValueObjectEmail('TestVO', value)).toThrowError('Invalid value for object email');
    });

    it('should throw an error for an email with special characters', () => {
        const value = 'test@exa!mple.com';
        expect(() => new ValueObjectEmail('TestVO', value)).toThrowError('Invalid value for object email');
    });
});
