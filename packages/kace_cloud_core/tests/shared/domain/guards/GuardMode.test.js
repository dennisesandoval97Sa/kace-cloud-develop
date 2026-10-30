import { GUARD_MODE, resolveGuardMode } from '../../../../src/shared/domain/guards/GuardMode.js';

describe('resolveGuardMode', () => {
    const original = process.env.SQL_GUARD_MODE;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.SQL_GUARD_MODE;
        } else {
            process.env.SQL_GUARD_MODE = original;
        }
    });

    it('defaults to enforce when the env var is unset', () => {
        delete process.env.SQL_GUARD_MODE;
        expect(resolveGuardMode()).toBe(GUARD_MODE.ENFORCE);
    });

    it('returns observe when SQL_GUARD_MODE=observe', () => {
        process.env.SQL_GUARD_MODE = 'observe';
        expect(resolveGuardMode()).toBe(GUARD_MODE.OBSERVE);
    });

    it('is case-insensitive and trims whitespace', () => {
        process.env.SQL_GUARD_MODE = '  OBSERVE  ';
        expect(resolveGuardMode()).toBe(GUARD_MODE.OBSERVE);
    });

    it('falls back to enforce for unknown values (fail-safe)', () => {
        process.env.SQL_GUARD_MODE = 'banana';
        expect(resolveGuardMode()).toBe(GUARD_MODE.ENFORCE);
    });
});
