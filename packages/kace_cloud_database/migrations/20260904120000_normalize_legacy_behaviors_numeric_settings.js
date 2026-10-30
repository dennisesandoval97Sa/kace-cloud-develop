/**
 * Prior to the Behaviors #NUMERIC_RULES validation, a partial update to any of
 * the numeric settings.behaviors leaves below could persist an out-of-range
 * value (merge() did not validate). The non-strict hydration path now
 * normalizes those values in memory on every read instead of throwing, but it
 * never rewrites the row, so a legacy invalid value keeps triggering that
 * normalization (and its debug log) on every read indefinitely. This
 * migration repairs the stored rows once so the normalization path stops
 * being exercised for existing data.
 *
 * NUMERIC_REPAIR_RULES MIRRORS Behaviors.#NUMERIC_RULES in
 * packages/kace_cloud_core/src/global-config/domain/settings/Behaviors.js
 * (this package cannot import @kace/core due to a circular dependency). They
 * are kept in lockstep by the test "migration repair rules cover every
 * Behaviors NUMERIC_RULES entry" in
 * kace_cloud_core/tests/global-config/Settings.test.js. Adding a rule to one
 * place without the other fails that test — if you edit one, edit the other.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

export const NUMERIC_REPAIR_RULES = [
    { path: ['admin', 'users', 'active_session_limit'], min: 1, max: 60, fallback: 2 },
    { path: ['admin', 'users', 'inactivity_time'], min: 1, max: 480, fallback: 120 },
    { path: ['admin', 'users', 'warning_logout_time'], min: 0, max: 60, fallback: 5 },
    { path: ['admin', 'users', 'group_membership_check_interval'], min: 0, fallback: 0 },
    { path: ['admin', 'reports', 'report_filter_days'], min: 1, max: 30, fallback: 1 },
    { path: ['agente', 'casos', 'assignment_active_session_limit'], min: 1, max: 60, fallback: 2 },
    { path: ['agente', 'onescript', 'onescript_cache_ttl_ms'], min: 0, fallback: 0 },
];

export const isValidInt = (value, min, max) => {
    if (typeof value !== 'number' && typeof value !== 'string') {
        return false;
    }
    if (typeof value === 'string' && value.trim() === '') {
        return false;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= min && (max === undefined || parsed <= max);
};

const resolveParent = (application, parentPath) => parentPath.reduce((acc, key) => acc?.[key], application);

export async function up(knex) {
    const rows = await knex('global_configurations').whereNotNull('settings');

    for (const row of rows) {
        const settings =
            typeof row.settings === 'string' ? JSON.parse(row.settings) : JSON.parse(JSON.stringify(row.settings));
        const application = settings?.behaviors?.application;
        let changed = false;

        if (application) {
            for (const rule of NUMERIC_REPAIR_RULES) {
                const leaf = rule.path[rule.path.length - 1];
                const parent = resolveParent(application, rule.path.slice(0, -1));
                if (!parent || !(leaf in parent)) {
                    continue;
                }
                if (!isValidInt(parent[leaf], rule.min, rule.max)) {
                    parent[leaf] = rule.fallback;
                    changed = true;
                }
            }

            const users = application.admin?.users;
            if (users) {
                const inactivityTime = Number(users.inactivity_time);
                const warningLogout = Number(users.warning_logout_time);
                if (warningLogout > 0 && warningLogout >= inactivityTime) {
                    users.warning_logout_time = 0;
                    changed = true;
                }
            }
        }

        if (changed) {
            await knex('global_configurations')
                .where('id', row.id)
                .update({ settings: JSON.stringify(settings) });
        }
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(_knex) {
    // Intentionally no-op: this repairs legacy out-of-range values, the
    // originals are not recoverable and restoring them would reintroduce
    // the bug this migration fixes.
}
