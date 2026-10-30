import { ValueObjectLogin } from '../../../src/users/domain/ValueObjectLogin.js';

describe('ValueObjectLogin', () => {
    it('accepts a valid login when nullable is explicitly false', () => {
        const vo = new ValueObjectLogin('login', 'jperez', false);

        expect(vo.value).toBe('jperez');
    });

    it('accepts a valid login when nullable is explicitly true', () => {
        const vo = new ValueObjectLogin('login', 'jperez', true);

        expect(vo.value).toBe('jperez');
    });

    it('throws when the value is falsy and nullable is false', () => {
        expect(() => new ValueObjectLogin('login', '', false)).toThrow('login: The value cannot be null');
    });

    it('returns without a value when the value is falsy and nullable is true', () => {
        const vo = new ValueObjectLogin('login', '', true);

        expect(vo.value).toBe('');
    });
});
