import { isUniqueViolation } from '../../src/emails/infrastructure/persistence/EmailPersistenceErrors.js';

describe('isUniqueViolation', () => {
    it('returns false for a falsy error', () => {
        expect(isUniqueViolation(null)).toBe(false);
        expect(isUniqueViolation(undefined)).toBe(false);
    });

    it('returns true for a Postgres unique_violation error code', () => {
        expect(isUniqueViolation({ code: '23505' })).toBe(true);
    });

    it('returns true for a legacy SQLITE_CONSTRAINT unique/primary key message', () => {
        expect(isUniqueViolation({ message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: emails.id' })).toBe(true);
    });

    it('returns false for an unrelated error', () => {
        expect(isUniqueViolation({ code: '23503', message: 'foreign key violation' })).toBe(false);
        expect(isUniqueViolation(new Error('boom'))).toBe(false);
    });

    it('returns false for an error object with no message at all', () => {
        expect(isUniqueViolation({ code: '42P01' })).toBe(false);
    });
});
