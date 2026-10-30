import { User } from '../../../src/users';
import UsersMother from './UsersMother.js';

describe('User superadmin flag', () => {
    test('defaults to false when not provided', () => {
        const user = new User(UsersMother.dto());
        expect(user.superadmin.value).toBe(false);
    });

    test('reads the value from the dto (boolean)', () => {
        const user = new User(UsersMother.dto({ superadmin: true }));
        expect(user.superadmin.value).toBe(true);
    });

    test('reads the value from the dto (1/0 as stored by some drivers)', () => {
        expect(new User(UsersMother.dto({ superadmin: 1 })).superadmin.value).toBe(1);
        expect(new User(UsersMother.dto({ superadmin: 0 })).superadmin.value).toBe(0);
    });

    test('is read-only: cannot be mutated through update()', () => {
        const user = new User(UsersMother.dto({ superadmin: false }));
        // No setter exists, so update() must not be able to flip the flag.
        expect(() => user.update({ superadmin: true })).toThrow();
        expect(user.superadmin.value).toBe(false);
    });
});
