import {
    SESSION_COOKIE_MAX_AGE_SECONDS,
    SESSION_KEY_ROTATION_MS,
    buildSetCookieHeader,
    shouldRotateSessionKey,
    resolveSessionKey,
} from '../../src/auth-cognito/domain/SessionCookieService.js';

describe('SessionCookieService', () => {
    const eightHoursMs = SESSION_KEY_ROTATION_MS;

    describe('buildSetCookieHeader', () => {
        it('builds HttpOnly Secure cookie with 8h Max-Age', () => {
            const header = buildSetCookieHeader('my-session-key', 'LAX');

            expect(header).toBe(
                `session_key=my-session-key; HttpOnly; Secure; SameSite=LAX; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`
            );
        });
    });

    describe('shouldRotateSessionKey', () => {
        it('returns false when rotatedAt is within 8h window', () => {
            const now = new Date('2026-06-12T12:00:00.000Z');
            const rotatedAt = new Date('2026-06-12T08:00:00.000Z');

            expect(shouldRotateSessionKey(rotatedAt, now)).toBe(false);
        });

        it('returns true when rotatedAt is exactly 8h ago', () => {
            const now = new Date('2026-06-12T12:00:00.000Z');
            const rotatedAt = new Date(now.getTime() - eightHoursMs);

            expect(shouldRotateSessionKey(rotatedAt, now)).toBe(true);
        });

        it('returns true when rotatedAt is null', () => {
            expect(shouldRotateSessionKey(null, new Date())).toBe(true);
        });
    });

    describe('resolveSessionKey', () => {
        const generateNew = () => 'new-generated-key';

        it('keeps existing key when rotation is not due', () => {
            const now = new Date('2026-06-12T12:00:00.000Z');
            const rotatedAt = new Date('2026-06-12T08:00:00.000Z');

            const result = resolveSessionKey({
                existingKey: 'stable-key',
                rotatedAt,
                now,
                forceNew: false,
                generateNew,
            });

            expect(result.sessionKey).toBe('stable-key');
            expect(result.rotated).toBe(false);
        });

        it('generates new key when rotation is due', () => {
            const now = new Date('2026-06-12T12:00:00.000Z');
            const rotatedAt = new Date(now.getTime() - eightHoursMs);

            const result = resolveSessionKey({
                existingKey: 'old-key',
                rotatedAt,
                now,
                forceNew: false,
                generateNew,
            });

            expect(result.sessionKey).toBe('new-generated-key');
            expect(result.rotated).toBe(true);
        });

        it('generates new key when forceNew is true', () => {
            const now = new Date('2026-06-12T12:00:00.000Z');
            const rotatedAt = new Date('2026-06-12T11:00:00.000Z');

            const result = resolveSessionKey({
                existingKey: 'stable-key',
                rotatedAt,
                now,
                forceNew: true,
                generateNew,
            });

            expect(result.sessionKey).toBe('new-generated-key');
            expect(result.rotated).toBe(true);
        });

        it('generates new key when existing key is null', () => {
            const result = resolveSessionKey({
                existingKey: null,
                rotatedAt: null,
                now: new Date(),
                forceNew: false,
                generateNew,
            });

            expect(result.sessionKey).toBe('new-generated-key');
            expect(result.rotated).toBe(true);
        });
    });
});
