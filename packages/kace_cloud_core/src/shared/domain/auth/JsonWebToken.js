import jwt from 'jsonwebtoken';

export class JsonWebToken {
    #secret = null;
    constructor(secret) {
        if (!secret) {
            throw new Error('The secret for jwt is required');
        }
        this.#secret = secret;
    }

    /**
     * @param {object} payload payload for save in jwt
     * @returns {string}
     */
    generateToken(payload) {
        const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
        return jwt.sign(payload, this.#secret, { expiresIn: expiresIn });
    }

    /**
     * @param {string} token Token jwt for validate user session
     * @returns {boolean}
     */
    verifyToken(token) {
        return jwt.verify(token, this.#secret);
    }

    /**
     * Decodes a JWT without verifying its signature.
     * Useful for reading claims from external tokens whose secret is not available.
     *
     * @param {string} token
     * @returns {object|null} Decoded payload, or null if the token is invalid/not a JWT.
     */
    static decode(token) {
        try {
            return jwt.decode(token) ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Checks whether a JWT token has expired.
     * Works with external tokens (no secret needed) by reading the `exp` claim.
     *
     * @param {string} token
     * @param {number} [safetyMarginMs=60000] Safety margin in milliseconds subtracted from expiry
     * @returns {boolean} `true` if the token is expired (or cannot be decoded), `false` if still valid.
     */
    static isExpired(token, safetyMarginMs = 60_000) {
        const payload = JsonWebToken.decode(token);
        if (!payload?.exp) return true;
        return payload.exp * 1000 - safetyMarginMs <= Date.now();
    }

    /**
     * Returns the remaining TTL in seconds for a JWT based on its `exp` claim.
     * Returns null if the token cannot be decoded, has no `exp`, or is already expired.
     *
     * @param {string} token - The JWT string.
     * @param {number} [safetyMarginSeconds=60] - Safety margin subtracted from the remaining time.
     * @returns {number|null} Remaining TTL in seconds (after safety margin), or null.
     */
    static getRemainingTtlSeconds(token, safetyMarginSeconds = 60) {
        const payload = JsonWebToken.decode(token);
        if (!payload?.exp) return null;

        const nowSeconds = Math.floor(Date.now() / 1000);
        const remaining = payload.exp - nowSeconds - safetyMarginSeconds;

        return remaining > 0 ? remaining : null;
    }
}
