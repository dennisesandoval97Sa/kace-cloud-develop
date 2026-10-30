import { ValueObjectBoolean } from '../../../../src/shared/index.js';

describe('ValueObjectBoolean', () => {
    it('should create an instance with a valid boolean value', () => {
        const value = true;
        const valueObject = new ValueObjectBoolean('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is not a boolean', () => {
        const value = 'not a boolean';
        expect(() => new ValueObjectBoolean('TestVO', value)).toThrowError('value must be a boolean');
    });

    it('should create an instance with false as a valid boolean value', () => {
        const value = false;
        const valueObject = new ValueObjectBoolean('TestVO', value);
        expect(valueObject.value).toBe(value);
    });
});
