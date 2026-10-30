import { ValueObjectColor } from '../../../../src/shared/index.js';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError.js';

describe('ValueObjectColor', () => {
    it('should create an instance with a valid 6-digit hex color', () => {
        const value = '#AABBCC';
        const valueObject = new ValueObjectColor('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should create an instance with a valid 3-digit hex color', () => {
        const value = '#ABC';
        const valueObject = new ValueObjectColor('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const value = null;
        expect(() => new ValueObjectColor('TestVO', value, false)).toThrow(InvalidArgumentError);
    });

    it('should create an instance with a null value if nullable is true', () => {
        const value = null;
        const valueObject = new ValueObjectColor('TestVO', value, true);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is an invalid hex color', () => {
        const value = 'invalid-color';
        expect(() => new ValueObjectColor('TestVO', value)).toThrow(InvalidArgumentError);
    });

    it('should throw an error if the value is an empty string and nullable is false', () => {
        const value = '';
        expect(() => new ValueObjectColor('TestVO', value, false)).toThrow(InvalidArgumentError);
    });

    it('should create an instance with an empty string if nullable is true', () => {
        const value = '';
        const valueObject = new ValueObjectColor('TestVO', value, true);
        expect(valueObject.value).toBe(value);
    });
});
