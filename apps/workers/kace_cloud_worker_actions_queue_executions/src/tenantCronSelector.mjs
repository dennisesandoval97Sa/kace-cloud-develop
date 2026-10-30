import { Helper } from '@kace/core/src/shared/index.js';
import { firesBetween, parseCronExpression } from './cronExpression.mjs';

// Per-tenant schedules (tenant record, DynamoDB); absent means the default.
export const FAST_SCHEDULE = { field: 'apps_worker_fast_cron_expression', defaultExpression: '* * * * *' };
export const ANS_SCHEDULE = { field: 'apps_worker_ans_cron_expression', defaultExpression: '*/5 * * * *' };
// Offset 2 minutes from the ANS `*/5`.
export const BACKLOG_SCHEDULE = {
    field: 'apps_assignment_backlog_cron_expression',
    defaultExpression: '2-59/5 * * * *',
};

const MINUTE_MS = 60000;
// A timer may fire slightly early; a late tick must never reach into the next minute.
const EARLY_TICK_TOLERANCE_MS = 5000;

const isAbsentSetting = (value) => value === undefined || value === null || value === '';

/**
 * @param {Tenant} tenant
 * @param {{field: string, defaultExpression: string}} schedule
 * @returns {import('croner').Cron}
 * @throws {Error} when the tenant value is present but not a valid cron
 */
export const resolveTenantCron = (tenant, { field, defaultExpression }) => {
    const value = tenant[field]?.value;
    return parseCronExpression(isAbsentSetting(value) ? defaultExpression : value, field);
};

/**
 * Selects the tenants whose cron fired since the previous evaluation, so a tick that arrives late
 * (blocked event loop) still runs them, and never twice for the same fire time.
 * While the runner is busy the window is not advanced: `runIfIdle` logs `runner.skip` and those
 * fires run once it is idle instead of being dropped.
 * A tenant whose cron cannot be resolved is logged and skipped; the others are unaffected.
 * @param {{
 *   resolveCron: (tenant: Tenant) => import('croner').Cron,
 *   isBusy?: () => boolean,
 *   invalidLogKey: string,
 *   logContext?: object
 * }} options
 * @returns {(tenants: Tenant[], now: Date) => Tenant[]}
 */
export const createTenantCronSelector = ({ resolveCron, isBusy = () => false, invalidLogKey, logContext = {} }) => {
    let since = null;
    // Last error logged per tenant: an invalid value is logged when it changes, not every minute.
    const loggedErrors = new Map();
    return (tenants, tickAt) => {
        const now = new Date(Math.floor((tickAt.getTime() + EARLY_TICK_TOLERANCE_MS) / MINUTE_MS) * MINUTE_MS);
        const from = since ?? new Date(now.getTime() - MINUTE_MS);
        if (!isBusy()) since = now;
        return tenants.filter((tenant) => {
            const tenantId = tenant.id?.value;
            try {
                const cron = resolveCron(tenant);
                loggedErrors.delete(tenantId);
                return firesBetween(cron, from, now);
            } catch (error) {
                if (loggedErrors.get(tenantId) !== error?.message) {
                    loggedErrors.set(tenantId, error?.message);
                    Helper.logError(invalidLogKey, { ...logContext, tenantId, err: error?.message });
                }
                return false;
            }
        });
    };
};
