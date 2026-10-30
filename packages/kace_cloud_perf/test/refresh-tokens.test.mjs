import { jest } from '@jest/globals';
import { isExpiringSoon, refreshIfNeeded } from '../auth/refresh-tokens.mjs';

describe('isExpiringSoon', () => {
    it('returns true when expiresAt is within the threshold', () => {
        const now = Date.now();
        const token = { expiresAt: now + 5 * 60 * 1000 };

        expect(isExpiringSoon(token, 15 * 60 * 1000)).toBe(true);
    });

    it('returns false when expiresAt is comfortably in the future', () => {
        const token = { expiresAt: Date.now() + 60 * 60 * 1000 };

        expect(isExpiringSoon(token, 15 * 60 * 1000)).toBe(false);
    });
});

describe('refreshIfNeeded', () => {
    it('refreshes only the expiring tokens, leaves the rest untouched', async () => {
        const valid = { username: 'u1', expiresAt: Date.now() + 3600_000, idToken: 'old1' };
        const stale = { username: 'u2', expiresAt: Date.now() + 60_000, idToken: 'old2' };
        const refresher = jest.fn(async (token) => ({ ...token, idToken: 'fresh', expiresAt: Date.now() + 3600_000 }));

        const result = await refreshIfNeeded([valid, stale], refresher, 15 * 60 * 1000);

        expect(refresher).toHaveBeenCalledTimes(1);
        expect(refresher).toHaveBeenCalledWith(stale);
        expect(result[0].idToken).toBe('old1');
        expect(result[1].idToken).toBe('fresh');
    });
});
