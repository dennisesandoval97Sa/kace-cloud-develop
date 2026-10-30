import { Cron } from 'croner';

const FIELDS = 5;

// croner also takes ISO dates (one shot) and a seconds field; the schedulers tick once a minute.
const assertSchedule = (expression, cron) => {
    if (String(expression).trim().split(/\s+/).length !== FIELDS) {
        throw new Error(`exactly ${FIELDS} fields are required`);
    }
    if (cron.nextRun() === null) {
        throw new Error('it never fires');
    }
};

/**
 * Parses a 5-field cron expression without scheduling it.
 * @param {string} expression
 * @param {string} name setting name, for the error message
 * @returns {Cron} paused instance
 */
export const parseCronExpression = (expression, name) => {
    try {
        const cron = new Cron(expression, { paused: true });
        assertSchedule(expression, cron);
        return cron;
    } catch (error) {
        throw new Error(`${name} must be a valid cron expression (received "${expression}"): ${error.message}`);
    }
};

/**
 * Whether the cron has a fire time in `(since, until]`.
 * @param {Cron} cron
 * @param {Date} since exclusive
 * @param {Date} until inclusive
 * @returns {boolean}
 */
export const firesBetween = (cron, since, until) => {
    const next = cron.nextRun(since);
    return next !== null && next.getTime() <= until.getTime();
};
