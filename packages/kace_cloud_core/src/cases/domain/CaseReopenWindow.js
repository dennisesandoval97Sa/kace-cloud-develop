import { ValidationFailError } from '../../shared/errors/ValidationFailError.js';
import { CaseReopenWindowExceededError } from './CaseReopenWindowExceededError.js';

const SETTINGS_PATH = 'settings.behaviors.application.agente.casos.reopen_cases_only_last_days';
const INVALID_DAYS_MESSAGE =
    'Invalid reopen window days value, the value must be a whole number greater than or equal to 0';

export class CaseReopenWindow {
    static DEFAULT_DAYS = 7;
    static MAX_DAYS = 36500;

    #days;

    constructor(days) {
        this.#days = days;
    }

    static fromConfig(rawDays) {
        if (rawDays === undefined || rawDays === null) {
            return new CaseReopenWindow(CaseReopenWindow.DEFAULT_DAYS);
        }

        const isUnparseableShape =
            typeof rawDays === 'boolean' ||
            typeof rawDays === 'object' ||
            (typeof rawDays === 'string' && rawDays.trim() === '');
        const parsed = Number(rawDays);

        if (isUnparseableShape || !Number.isInteger(parsed) || parsed < 0 || parsed > CaseReopenWindow.MAX_DAYS) {
            throw new ValidationFailError(INVALID_DAYS_MESSAGE, SETTINGS_PATH);
        }

        return new CaseReopenWindow(parsed);
    }

    get days() {
        return this.#days;
    }

    get isUnlimited() {
        return this.#days === 0;
    }

    /**
     * Compares `createdAt` against now minus N days using `Date#setDate` on the runtime clock
     * (same arithmetic as the previous PermissionValidator check). The window is N times 24 hours
     * from `created_at`, not tenant-local calendar days at 00:00.
     *
     * The window is read from the acting user's active group, not from the case's group.
     * Product confirmed that an agent with several memberships uses the config of
     * `grupo_activo` at the time of the reopen.
     *
     * @param {Date|string|number} createdAt
     * @param {Date} [now]
     */
    ensureAllowsReopen(createdAt, now = new Date()) {
        if (this.isUnlimited) {
            return;
        }

        const currentDate = new Date(now);
        const caseCreationDate = new Date(createdAt);
        const daysAgo = new Date(currentDate);
        daysAgo.setDate(currentDate.getDate() - this.#days);

        if (caseCreationDate < daysAgo) {
            throw new CaseReopenWindowExceededError(this.#days);
        }
    }
}
