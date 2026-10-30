import crypto from 'crypto';
import PasswordEncoder from './PasswordEncoder';

/**
 * Enhanced password encoder with hybrid SHA-256 + bcrypt hashing
 * for secure handling of long passwords beyond bcrypt's 72-byte limit
 */
export default class SecurePasswordEncoder extends PasswordEncoder {
    /**
     * Generates a secure hybrid hash for the given password
     * @param {string} plaintextPassword - The password to hash
     * @returns {string} The hashed password
     */
    static createHash(plaintextPassword) {
        const prehashedPassword = this.prehashWithSHA256(plaintextPassword);
        return super.generateHash(prehashedPassword);
    }

    /**
     * Verifies a password against a stored hash
     * @param {string} plaintextPassword - The password to verify
     * @param {string} storedHash - The stored hash to compare against
     * @returns {boolean} True if the password matches the hash
     */
    static verifyPassword(plaintextPassword, storedHash) {
        const prehashedPassword = this.prehashWithSHA256(plaintextPassword);
        return super.compareHash(prehashedPassword, storedHash);
    }

    /**
     * Internal utility method for consistent pre-hashing
     * @private
     */
    static prehashWithSHA256(input) {
        return crypto.createHash('sha256').update(input).digest('hex');
    }
}
