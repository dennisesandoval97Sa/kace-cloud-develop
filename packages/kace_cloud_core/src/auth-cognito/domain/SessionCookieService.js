import { randomBytes } from 'crypto';
import PasswordEncoder from '../../shared/domain/crypto/PasswordEncoder.js';

export const SESSION_COOKIE_MAX_AGE_SECONDS = 28800;
export const SESSION_KEY_ROTATION_MS = 8 * 60 * 60 * 1000;

export function generateSessionKey() {
    return PasswordEncoder.generateHash(randomBytes(64).toString('hex'));
}

export function buildSetCookieHeader(sessionKey, sameSite) {
    return `session_key=${sessionKey}; HttpOnly; Secure; SameSite=${sameSite}; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`;
}

export function shouldRotateSessionKey(rotatedAt, now = new Date()) {
    if (rotatedAt === null || rotatedAt === undefined) {
        return true;
    }

    const rotatedAtMs = rotatedAt instanceof Date ? rotatedAt.getTime() : new Date(rotatedAt).getTime();
    return now.getTime() - rotatedAtMs >= SESSION_KEY_ROTATION_MS;
}

export function resolveSessionKey({ existingKey, rotatedAt, now = new Date(), forceNew = false, generateNew }) {
    const needsNewKey =
        forceNew || existingKey === null || existingKey === undefined || shouldRotateSessionKey(rotatedAt, now);

    if (needsNewKey) {
        return {
            sessionKey: generateNew(),
            rotated: true,
        };
    }

    return {
        sessionKey: existingKey,
        rotated: false,
    };
}
