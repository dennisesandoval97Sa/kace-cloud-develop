import { ValueObjectDecimal } from '../../../../src/shared/domain/value-object/ValueObjectDecimal.js';

describe('ValueObjectDecimal', () => {
    it('should create an instance with a valid decimal value', () => {
        const value = 45.55998535156249;
        const valueObject = new ValueObjectDecimal('test', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const value = null;
        expect(() => new ValueObjectDecimal('test', value, false)).toThrowError('The value cannot be null');
    });

    it('should create an instance with a null value if nullable is true', () => {
        const value = null;
        const valueObject = new ValueObjectDecimal('test', value, true);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is not a number', () => {
        const value = 'not a number';
        expect(() => new ValueObjectDecimal('test', value)).toThrowError('test: The value must be a valid number');
    });

    it('should throw an error if the value is undefined and nullable is false', () => {
        const value = undefined;
        expect(() => new ValueObjectDecimal('test', value, false)).toThrowError('The value cannot be null');
    });

    it('should accept an integer value as valid', () => {
        const value = 10;
        const valueObject = new ValueObjectDecimal('test', value);
        expect(valueObject.value).toBe(value);
    });

    it('should accept zero as a valid decimal value', () => {
        const value = 0.0;
        const valueObject = new ValueObjectDecimal('test', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is NaN', () => {
        const value = NaN;
        expect(() => new ValueObjectDecimal('test', value)).toThrowError('test: The value must be a valid number');
    });
});
