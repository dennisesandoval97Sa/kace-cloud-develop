import { CaseReopenWindow } from '../../src/cases/domain/CaseReopenWindow.js';
import { CaseReopenWindowExceededError } from '../../src/cases/domain/CaseReopenWindowExceededError.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import { CASE_REOPEN_WINDOW_EXCEEDED } from '@kace/error-codes';

describe('CaseReopenWindow', () => {
    const now = new Date('2026-08-25T12:00:00.000Z');

    it('defaults missing config to 7 days', () => {
        expect(CaseReopenWindow.fromConfig(undefined).days).toBe(7);
        expect(CaseReopenWindow.fromConfig(null).days).toBe(7);
        expect(CaseReopenWindow.DEFAULT_DAYS).toBe(7);
    });

    it('treats 0 as unlimited and does not throw', () => {
        const window = CaseReopenWindow.fromConfig(0);
        expect(window.isUnlimited).toBe(true);
        const createdAt = new Date('2000-01-01T00:00:00.000Z');
        expect(() => window.ensureAllowsReopen(createdAt, now)).not.toThrow();
    });

    it('allows reopen when created_at is within the window', () => {
        const window = CaseReopenWindow.fromConfig(7);
        const createdAt = new Date('2026-08-22T12:00:00.000Z');
        expect(() => window.ensureAllowsReopen(createdAt, now)).not.toThrow();
    });

    it('rejects reopen when created_at is older than the window', () => {
        const window = CaseReopenWindow.fromConfig(7);
        const createdAt = new Date('2026-08-17T12:00:00.000Z');
        expect(() => window.ensureAllowsReopen(createdAt, now)).toThrow(CaseReopenWindowExceededError);
        try {
            window.ensureAllowsReopen(createdAt, now);
        } catch (error) {
            expect(error).toBeInstanceOf(CustomError);
            expect(error.statusCode).toBe(422);
            expect(error.publicErrorCode).toBe(CASE_REOPEN_WINDOW_EXCEEDED);
            expect(error.message).toBe('CASE_REOPEN_WINDOW_EXCEEDED:7');
            expect(error.toPublicData()).toEqual({ days: 7 });
        }
    });

    it('rejects negative, non-integer and non-numeric values', () => {
        expect(() => CaseReopenWindow.fromConfig(-1)).toThrow(ValidationFailError);
        expect(() => CaseReopenWindow.fromConfig(1.5)).toThrow(ValidationFailError);
        expect(() => CaseReopenWindow.fromConfig('abc')).toThrow(ValidationFailError);
    });

    it('rejects empty string, boolean and array instead of coercing them to a window', () => {
        expect(() => CaseReopenWindow.fromConfig('')).toThrow(ValidationFailError);
        expect(() => CaseReopenWindow.fromConfig('  ')).toThrow(ValidationFailError);
        expect(() => CaseReopenWindow.fromConfig(true)).toThrow(ValidationFailError);
        expect(() => CaseReopenWindow.fromConfig([])).toThrow(ValidationFailError);
    });

    it('rejects values above MAX_DAYS so setDate cannot overflow into unlimited', () => {
        expect(CaseReopenWindow.MAX_DAYS).toBe(36500);
        expect(() => CaseReopenWindow.fromConfig(CaseReopenWindow.MAX_DAYS)).not.toThrow();
        expect(() => CaseReopenWindow.fromConfig(CaseReopenWindow.MAX_DAYS + 1)).toThrow(ValidationFailError);
    });
});
