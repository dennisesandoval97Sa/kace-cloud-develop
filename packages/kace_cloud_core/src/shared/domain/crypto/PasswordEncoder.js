import bcrypt from 'bcryptjs';
import { RuntimeError } from '../../errors/RuntimeError.js';
import { Helper } from '../../infrastructure/utils/Helper.js';

export default class PasswordEncoder {
    static generateHash(plainPassword) {
        const saltRounds = 10;
        let hash = null;
        try {
            hash = bcrypt.hashSync(plainPassword, saltRounds);
        } catch (error) {
            Helper.logError('Hash generation fail', error);
            throw new RuntimeError('Hash generation fail');
        }

        return hash;
    }

    /**
     *
     * @param {string} plainPassword
     * @param {string} hash
     * @returns boolean
     * @throws RuntimeError
     */
    static compareHash(plainPassword, hash) {
        let result = null;
        try {
            result = bcrypt.compareSync(plainPassword, hash);
        } catch (error) {
            Helper.logError('Hash comparison fail', error);
            throw new RuntimeError('Hash comparison fail');
        }

        return result;
    }
}
