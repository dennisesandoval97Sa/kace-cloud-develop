import { ValueObjectInt } from '../../../../src/shared/index.js';

describe('ValueObjectInt', () => {
    it('should create an instance with a valid integer value', () => {
        const value = 123;
        const valueObject = new ValueObjectInt('test', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const value = null;
        expect(() => new ValueObjectInt('test', value, false)).toThrowError('The value cannot be null');
    });

    it('should create an instance with a null value if nullable is true', () => {
        const value = null;
        const valueObject = new ValueObjectInt('test', value, true);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is not a BigInt', () => {
        const value = 'not an integer';
        expect(() => new ValueObjectInt('test', value)).toThrowError('test: The value must be a number');
    });

    it('should throw an error if the value is undefined and nullable is false', () => {
        const value = undefined;
        expect(() => new ValueObjectInt('test', value, false)).toThrowError('The value cannot be null');
    });

    it('should accept zero as a valid value', () => {
        const value = 0;
        const valueObject = new ValueObjectInt('test', value);
        expect(valueObject.value).toBe(value);
    });
});
