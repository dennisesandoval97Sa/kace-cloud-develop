import { ValueObjectUuid } from '../../../../src/shared/index.js';
import { validate as uuidValidate } from 'uuid';

describe('ValueObjectUuid', () => {
    it('should create an instance with a valid UUID', () => {
        const value = '550e8400-e29b-41d4-a716-446655440000';
        const valueObject = new ValueObjectUuid('TestUuid', value);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const value = null;
        expect(() => new ValueObjectUuid('TestUuid', value, false)).toThrowError('The value cannot be null');
    });

    it('should create an instance with a null value if nullable is true', () => {
        const value = null;
        const valueObject = new ValueObjectUuid('TestUuid', value, true);
        expect(valueObject.value).toBe(value);
    });

    it('should throw an error if the value is an invalid UUID', () => {
        const value = 'invalid-uuid';
        expect(() => new ValueObjectUuid('TestUuid', value)).toThrowError('Invalid value invalid-uuid for object uuid');
    });

    it('should generate a valid random UUID', () => {
        const value = ValueObjectUuid.random();
        expect(uuidValidate(value)).toBe(true);
    });
});
