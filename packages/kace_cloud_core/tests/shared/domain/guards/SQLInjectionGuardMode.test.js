import { jest } from '@jest/globals';
import { SQLInjectionGuard } from '../../../../src/shared/domain/guards/SQLInjectionGuard.js';
import { SQLInjectionCriteriaGuard } from '../../../../src/shared/domain/guards/SQLInjectionCriteriaGuard.js';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError.js';
import { SQL_BLACKLIST_WORD_DETECTED } from '@kace/error-codes';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';

describe('SQLInjectionGuard mode behavior', () => {
    let original;
    const malicious = "'; DROP TABLE users; -- select from";

    let logErrorSpy;
    let logMetricSpy;

    beforeEach(() => {
        original = process.env.SQL_GUARD_MODE;
        logErrorSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        logMetricSpy = jest.spyOn(Helper, 'logMetric').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (original === undefined) {
            delete process.env.SQL_GUARD_MODE;
        } else {
            process.env.SQL_GUARD_MODE = original;
        }
    });

    describe('enforce mode (default)', () => {
        beforeEach(() => {
            delete process.env.SQL_GUARD_MODE;
        });

        it('throws InvalidArgumentError on malicious input', () => {
            expect(() => SQLInjectionGuard.validate(malicious, 'descripcion')).toThrow(InvalidArgumentError);
        });

        it('tags malicious input errors with the public error code', () => {
            let error;
            try {
                SQLInjectionGuard.validate(malicious, 'descripcion');
            } catch (caughtError) {
                error = caughtError;
            }

            expect(error).toBeInstanceOf(InvalidArgumentError);
            expect(error.publicErrorCode).toBe(SQL_BLACKLIST_WORD_DETECTED);
        });

        it('returns false when throwError=false', () => {
            expect(SQLInjectionGuard.validate(malicious, 'descripcion', false)).toBe(false);
        });

        it('does not emit the observe metric', () => {
            expect(() => SQLInjectionGuard.validate(malicious, 'descripcion')).toThrow();
            expect(logMetricSpy).not.toHaveBeenCalled();
        });
    });

    describe('observe mode', () => {
        beforeEach(() => {
            process.env.SQL_GUARD_MODE = 'observe';
        });

        it('does NOT throw on malicious input', () => {
            expect(() => SQLInjectionGuard.validate(malicious, 'descripcion')).not.toThrow();
        });

        it('emits logError and the SQLGuardObserved metric with the Field dimension', () => {
            SQLInjectionGuard.validate(malicious, 'descripcion');
            expect(logErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[observe]'));
            expect(logMetricSpy).toHaveBeenCalledWith('SQLGuardObserved', 1, 'Count', { Field: 'descripcion' });
        });

        it('does nothing for clean input', () => {
            SQLInjectionGuard.validate('un texto perfectamente normal', 'descripcion');
            expect(logErrorSpy).not.toHaveBeenCalled();
            expect(logMetricSpy).not.toHaveBeenCalled();
        });

        it('returns false without throwing or logging when throwError=false', () => {
            const result = SQLInjectionGuard.validate(malicious, 'descripcion', false);
            expect(result).toBe(false);
            expect(logErrorSpy).not.toHaveBeenCalled();
            expect(logMetricSpy).not.toHaveBeenCalled();
        });
    });
});

describe('SQLInjectionCriteriaGuard mode behavior', () => {
    let original;
    const malicious = "value' OR 1=1 -- from where";

    let logErrorSpy;
    let logMetricSpy;

    beforeEach(() => {
        original = process.env.SQL_GUARD_MODE;
        logErrorSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        logMetricSpy = jest.spyOn(Helper, 'logMetric').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (original === undefined) {
            delete process.env.SQL_GUARD_MODE;
        } else {
            process.env.SQL_GUARD_MODE = original;
        }
    });

    it('throws in enforce mode (default)', () => {
        delete process.env.SQL_GUARD_MODE;
        expect(() => SQLInjectionCriteriaGuard.validate(malicious, 'criteria.value')).toThrow(InvalidArgumentError);
    });

    it('tags enforce mode errors with the public error code', () => {
        delete process.env.SQL_GUARD_MODE;
        let error;
        try {
            SQLInjectionCriteriaGuard.validate(malicious, 'criteria.value');
        } catch (caughtError) {
            error = caughtError;
        }

        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.publicErrorCode).toBe(SQL_BLACKLIST_WORD_DETECTED);
    });

    it('does not throw and emits the metric in observe mode', () => {
        process.env.SQL_GUARD_MODE = 'observe';
        expect(() => SQLInjectionCriteriaGuard.validate(malicious, 'criteria.value')).not.toThrow();
        expect(logMetricSpy).toHaveBeenCalledWith('SQLGuardObserved', 1, 'Count', { Field: 'criteria.value' });
        expect(logErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[observe]'));
    });
});
