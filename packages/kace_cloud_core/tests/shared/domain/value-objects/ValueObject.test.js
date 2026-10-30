import { ValueObject } from '../../../../src/shared/index.js';

describe('ValueObject', () => {
    it('should create an instance with a valid value', () => {
        const value = 'some value';
        const valueObject = new ValueObject('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should create an instance with a null value', () => {
        const value = null;
        const valueObject = new ValueObject('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should create an instance with an undefined value', () => {
        const value = undefined;
        const valueObject = new ValueObject('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should create an instance with a numeric value', () => {
        const value = 123;
        const valueObject = new ValueObject('TestVO', value);
        expect(valueObject.value).toBe(value);
    });

    it('should create an instance with a boolean value', () => {
        const value = true;
        const valueObject = new ValueObject('TestVO', value);
        expect(valueObject.value).toBe(value);
    });
});
