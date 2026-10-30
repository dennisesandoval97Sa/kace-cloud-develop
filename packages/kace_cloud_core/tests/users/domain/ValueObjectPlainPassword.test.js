import { ValueObjectPlainPassword } from '../../../src/users/domain/ValueObjectPlainPassword.js';
import { User } from '../../../src/users/domain/User.js';
import UsersMother from './UsersMother.js';

describe('ValueObjectPlainPassword', () => {
    const validPassword = 'Str0ng!Passw0rd#2026';

    it('accepts a password that passes every PasswordRegexValidator rule', () => {
        const user = new User(UsersMother.dto({ login: 'jperez' }));

        const vo = new ValueObjectPlainPassword('password', validPassword, user);

        expect(vo.value).toBe(validPassword);
    });

    it('throws when UserModel is not an instance of User', () => {
        expect(() => new ValueObjectPlainPassword('password', validPassword, { login: 'jperez' })).toThrow(
            'User must be an instance of User'
        );
    });

    it('skips password validation entirely when value is falsy', () => {
        const user = new User(UsersMother.dto({ login: 'jperez' }));

        const vo = new ValueObjectPlainPassword('password', '', user);

        expect(vo.value).toBe('');
    });

    it('throws with the validator messages when the password fails a rule (missing uppercase)', () => {
        const user = new User(UsersMother.dto({ login: 'jperez' }));

        expect(() => new ValueObjectPlainPassword('password', 'weakpassword123!', user)).toThrow(
            /Debe contener al menos una mayúscula/
        );
    });

    it('throws when the password contains a reserved word', () => {
        const user = new User(UsersMother.dto({ login: 'jperez' }));

        expect(() => new ValueObjectPlainPassword('password', 'Konecta!Str0ngPass', user)).toThrow(
            /No puedes usar palabras reservadas/
        );
    });
});
