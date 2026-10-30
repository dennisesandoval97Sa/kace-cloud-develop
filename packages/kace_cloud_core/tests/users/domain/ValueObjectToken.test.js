import { ValueObjectToken } from '../../../src/users/domain/ValueObjectToken.js';

describe('ValueObjectToken', () => {
    it('accepts a non-empty string value when nullable is true', () => {
        const vo = new ValueObjectToken('token', 'a-valid-token', true);

        expect(vo.value).toBe('a-valid-token');
    });

    it('accepts a non-empty string value when nullable is false', () => {
        const vo = new ValueObjectToken('token', 'a-valid-token', false);

        expect(vo.value).toBe('a-valid-token');
    });

    it('throws when the value is falsy and nullable is false', () => {
        expect(() => new ValueObjectToken('token', '', false)).toThrow('token: The value cannot be null');
    });

    it('returns without a value when the value is falsy and nullable is true', () => {
        const vo = new ValueObjectToken('token', '', true);

        expect(vo.value).toBe('');
    });
});
