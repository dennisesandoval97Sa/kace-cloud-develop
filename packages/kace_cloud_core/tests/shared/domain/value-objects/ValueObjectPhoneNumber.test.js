import { ValueObjectPhoneNumber } from '../../../../src/shared/index.js';

describe('ValueObjectPhoneNumber', () => {
    it('should create an instance with a valid phone number', () => {
        const value = '1234567890';
        const valueObject = new ValueObjectPhoneNumber('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const value = null;
        expect(() => new ValueObjectPhoneNumber('TestVO', value, false)).toThrowError('The value cannot be null');
    });

    it('should create an instance with a null value if nullable is true', () => {
        const value = null;
        const valueObject = new ValueObjectPhoneNumber('TestVO', value, true);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is not a string', () => {
        const value = 1234567890;
        expect(() => new ValueObjectPhoneNumber('TestVO', value)).toThrowError('value must be a string');
    });

    it('should throw an error if the value is too short', () => {
        const value = '123456789';
        expect(() => new ValueObjectPhoneNumber('TestVO', value)).toThrowError(
            'The value must be at least 10 characters long'
        );
    });

    it('should throw an error if the value is too long', () => {
        const value = '12345678901';
        expect(() => new ValueObjectPhoneNumber('TestVO', value)).toThrowError(
            'The value must be at most 10 characters long'
        );
    });

    it('should throw an error if the value contains invalid characters', () => {
        const value = '12345abcde';
        expect(() => new ValueObjectPhoneNumber('TestVO', value)).toThrowError(
            'The phone number must contain only numbers'
        );
    });
});
