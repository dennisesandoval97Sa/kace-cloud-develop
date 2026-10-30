import { SQLInjectionDictionary } from '../security/SQLInjectionDictionary.js';
import { InvalidArgumentError } from '../../errors/InvalidArgumentError.js';
import { SQL_BLACKLIST_WORD_DETECTED } from '@kace/error-codes';
import { Helper } from '../../infrastructure/utils/Helper.js';
import { GUARD_MODE, resolveGuardMode } from './GuardMode.js';

export class SQLInjectionCriteriaGuard {
    /**
     * Same contract as SQLInjectionGuard.validate but uses the criteria
     * dictionary (used for JSON keys/values).
     *
     * When `throwError` is `false` the method always returns `false` on a
     * match, without logging or emitting any metric, regardless of guard mode.
     *
     * In `observe` mode it logs the detection (input truncated to 200 chars) +
     * emits a metric and returns without throwing.
     *
     * @param {string} input
     * @param {string} fieldName
     * @param {boolean} [throwError=true]
     */
    static validate(input, fieldName, throwError = true) {
        const invalidWords = SQLInjectionDictionary.findSQLInjectionCriteriaPatterns(input);
        if (!invalidWords.length) {
            return;
        }

        if (!throwError) {
            return false;
        }

        if (resolveGuardMode() === GUARD_MODE.OBSERVE) {
            const preview = String(input).slice(0, 200);
            Helper.logError(`SQL guard [observe] field=${fieldName} tokens=${invalidWords.join(', ')}: ${preview}`);
            Helper.logMetric('SQLGuardObserved', 1, 'Count', { Field: fieldName });
            return;
        }

        Helper.logError(`SQL blacklist word detected in field ${fieldName} - ${invalidWords.join(', ')}: ${input}`);
        throw new InvalidArgumentError(
            `Palabras prohibidas detectadas en ${fieldName} - ${invalidWords.join(', ')}: ${input}`,
            400,
            SQL_BLACKLIST_WORD_DETECTED
        );
    }
}
