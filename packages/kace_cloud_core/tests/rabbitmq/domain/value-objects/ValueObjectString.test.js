import { ValueObjectString } from '../../../../src/rabbitmq/domain/value-objects/ValueObjectString.js';

describe('ValueObjectString', () => {
    it('accepts a string value (nullable defaulted, not passed)', () => {
        const vo = new ValueObjectString('field', 'a value');

        expect(vo.value).toBe('a value');
    });

    it('accepts a string value when nullable is explicitly true', () => {
        const vo = new ValueObjectString('field', 'a value', true);

        expect(vo.value).toBe('a value');
    });

    it('throws when the value is undefined and nullable is false', () => {
        expect(() => new ValueObjectString('field', undefined, false)).toThrow('field is required');
    });

    it('throws when the value is null and nullable is false', () => {
        expect(() => new ValueObjectString('field', null, false)).toThrow('field is required');
    });

    it('returns a null value when nullable is true and the value is missing', () => {
        const vo = new ValueObjectString('field', undefined, true);

        expect(vo.value).toBeNull();
    });

    it('rejects a non-string value', () => {
        expect(() => new ValueObjectString('field', 12345)).toThrow('field must be a string');
    });
});
