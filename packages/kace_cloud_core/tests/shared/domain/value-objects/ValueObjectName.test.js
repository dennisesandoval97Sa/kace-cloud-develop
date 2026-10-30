import { ValueObjectName } from '../../../../src/shared/index.js';

describe('ValueObjectName', () => {
    it('should create an instance with a valid name', () => {
        const value = 'John Doe';
        const valueObject = new ValueObjectName('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const value = null;
        expect(() => new ValueObjectName('TestVO', value, false)).toThrowError('The value cannot be null');
    });

    it('should create an instance with a null value if nullable is true', () => {
        const value = null;
        const valueObject = new ValueObjectName('TestVO', value, true);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is not a string', () => {
        const value = 123;
        expect(() => new ValueObjectName('TestVO', value)).toThrowError('value must be a string');
    });

    it('should throw an error if the value is too short', () => {
        const value = 'Jo';
        expect(() => new ValueObjectName('TestVO', value)).toThrowError('The value must be at least 3 characters long');
    });

    it('should throw an error if the value is too long', () => {
        const value = 'J'.repeat(101);
        expect(() => new ValueObjectName('TestVO', value)).toThrowError(
            'The value must be at most 100 characters long'
        );
    });

    it('should throw an error if the value contains invalid characters', () => {
        const value = 'John123';
        expect(() => new ValueObjectName('TestVO', value)).toThrowError('The name must contain only letters');
    });
});
