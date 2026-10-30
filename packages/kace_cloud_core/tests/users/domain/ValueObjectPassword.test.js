import ValueObjectPassword from '../../../src/users/domain/ValueObjectPassword.js';

describe('ValueObjectPassword', () => {
    it('accepts a non-empty string value (nullable defaulted, not passed)', () => {
        const vo = new ValueObjectPassword('password', 'hashed-value');

        expect(vo.value).toBe('hashed-value');
    });

    it('accepts a non-empty string value when nullable is explicitly true', () => {
        const vo = new ValueObjectPassword('password', 'hashed-value', true);

        expect(vo.value).toBe('hashed-value');
    });

    it('accepts a non-empty string value when nullable is explicitly false', () => {
        const vo = new ValueObjectPassword('password', 'hashed-value', false);

        expect(vo.value).toBe('hashed-value');
    });

    it('throws when the value is falsy and nullable is false', () => {
        expect(() => new ValueObjectPassword('password', '', false)).toThrow('password: The value cannot be null');
    });

    it('returns without a value when the value is falsy and nullable is true', () => {
        const vo = new ValueObjectPassword('password', '', true);

        expect(vo.value).toBe('');
    });

    it('rejects a non-string value', () => {
        expect(() => new ValueObjectPassword('password', 12345678, false)).toThrow();
    });
});
