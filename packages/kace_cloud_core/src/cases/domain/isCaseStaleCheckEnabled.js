import { STALE_FIELDS } from './staleFields.js';

const ALL_STALE_FIELDS = STALE_FIELDS.map(({ field }) => field);

/**
 * Which snapshot fields get CAS for this tenant.
 *
 * `case_stale_check: true` enables every field in {@link STALE_FIELDS}. Explicit
 * `false` disables every field, including legacy flags. `null` / omitted keeps
 * the historical scope: only `transicion_id` / `responsable_id` when their own
 * flags are on.
 *
 * There is no fleet SQL backfill. General Setup omits `case_stale_check` until
 * an admin toggles the checkbox, so tenants that never touched the unified key
 * stay on the legacy pair. That omit-until-touch write is the migration.
 *
 * @param {object} [behavior={}]
 * @returns {string[]}
 */
export function enabledStaleFields(behavior = {}) {
    const unified = behavior.case_stale_check;
    if (unified === true) {
        return [...ALL_STALE_FIELDS];
    }
    if (unified === false) {
        return [];
    }
    const legacy = [];
    if (behavior.transition_stale_check) {
        legacy.push('transicion_id');
    }
    if (behavior.responsable_stale_check) {
        legacy.push('responsable_id');
    }
    return legacy;
}

/**
 * Whether any stale-snapshot check is enabled for the tenant.
 *
 * @param {object} [behavior={}]
 * @returns {boolean}
 */
export function isCaseStaleCheckEnabled(behavior = {}) {
    return enabledStaleFields(behavior).length > 0;
}
