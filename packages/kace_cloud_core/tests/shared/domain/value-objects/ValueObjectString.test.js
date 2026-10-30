import { ValueObjectString } from '../../../../src/shared/index.js';

describe('ValueObjectString', () => {
    it('should create an instance with a valid string', () => {
        const value = 'valid string';
        const valueObject = new ValueObjectString('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const value = null;
        expect(() => new ValueObjectString('TestVO', value, false)).toThrowError('The value cannot be null');
    });

    it('should create an instance with a null value if nullable is true', () => {
        const value = null;
        const valueObject = new ValueObjectString('TestVO', value, true);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is not a string', () => {
        const value = 123;
        expect(() => new ValueObjectString('TestVO', value)).toThrowError('value must be a string');
    });

    it('should throw an error if the value is an empty string and nullable is false', () => {
        const value = '';
        expect(() => new ValueObjectString('TestVO', value, false)).toThrowError('The value cannot be null');
    });
});
