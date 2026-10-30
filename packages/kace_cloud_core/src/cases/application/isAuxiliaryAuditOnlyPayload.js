const AUDIT_KEYS = new Set(['updated_at', 'updated_by']);

/**
 * True when an auxiliary update payload carries no domain changes — only audit
 * timestamps (and optionally `current_*` CAS metadata) with empty aux and no description.
 *
 * The audit-only shortcut writes `updated_at` / `updated_by` and does **not**
 * publish `CaseUpdated` / `EDIT_CASE`, call `saveHistory`, or recalculate SLA.
 *
 * @param {object} payload
 * @returns {boolean}
 */
export function isAuxiliaryAuditOnlyPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    if (payload.description !== undefined) {
        return false;
    }

    const aux = payload.aux_cases;
    const auxEmpty = !aux || Object.keys(aux).length === 0;
    if (!auxEmpty) {
        return false;
    }

    const caseObj = payload.case ?? {};
    const hasDomainKey = Object.keys(caseObj).some((key) => !AUDIT_KEYS.has(key) && !key.startsWith('current_'));

    return !hasDomainKey;
}
