import { enabledStaleFields } from '../domain/isCaseStaleCheckEnabled.js';
import { STALE_FIELDS, STALE_SNAPSHOT_MESSAGE } from '../domain/staleFields.js';

export { STALE_FIELDS, STALE_SNAPSHOT_MESSAGE };

function emptySnapshots() {
    return Object.fromEntries(STALE_FIELDS.map(({ resultKey }) => [resultKey, undefined]));
}

export class CaseStaleSnapshotEvaluator {
    /**
     * Compares load-time snapshots against the DB and returns a copy of `caseValue`
     * with stale fields and snapshot keys removed. Does not mutate the input.
     *
     * When a check is on and the field is not stripped, the matching `*Snapshot`
     * is the load-time value for a later snapshot-conditional write in CaseUpdater.
     *
     * @param {object} params
     * @param {object} params.repository
     * @param {() => Promise<object>} [params.getGlobalConfig] - loaded when any snapshot is present
     * @param {string} params.caseId
     * @param {object} params.caseValue
     * @returns {Promise<object>}
     */
    static async execute({ repository, getGlobalConfig, caseId, caseValue }) {
        const snapshots = {};
        const next = { ...caseValue };
        for (const { snapshotKey } of STALE_FIELDS) {
            snapshots[snapshotKey] = caseValue[snapshotKey];
            delete next[snapshotKey];
        }

        const warnings = [];
        const hasAnySnapshot = STALE_FIELDS.some(({ snapshotKey }) => snapshots[snapshotKey] !== undefined);

        const globalConfig = hasAnySnapshot ? await getGlobalConfig() : undefined;
        const behavior = globalConfig?.settings.behaviors.getConfig('agente', 'casos') ?? {};
        const enabledFields = new Set(enabledStaleFields(behavior));
        const hasEnabledSnapshot = STALE_FIELDS.some(
            ({ field, snapshotKey }) => enabledFields.has(field) && snapshots[snapshotKey] !== undefined
        );
        const needRead = hasEnabledSnapshot;

        const fields = needRead ? await repository.getStaleSnapshotFields(caseId) : undefined;
        const missing = needRead && fields === undefined;

        const result = emptySnapshots();

        for (const { field, snapshotKey, code, dbKey, resultKey } of STALE_FIELDS) {
            const snapshot = snapshots[snapshotKey];
            if (snapshot === undefined || !enabledFields.has(field)) {
                continue;
            }

            const isStale = !missing && fields !== undefined && fields[dbKey] !== snapshot;
            if (isStale) {
                delete next[field];
                warnings.push({ code, message: STALE_SNAPSHOT_MESSAGE });
            }

            if (!isStale && next[field] !== undefined) {
                result[resultKey] = snapshot;
            }
        }

        return { warnings, caseValue: next, ...result };
    }

    /**
     * Controller wiring: skip work when no snapshot key is present.
     *
     * @param {object} params
     * @returns {Promise<object>}
     */
    static async prepare(params) {
        const hasSnapshots = STALE_FIELDS.some(({ snapshotKey }) => params.caseValue[snapshotKey] !== undefined);
        if (!hasSnapshots) {
            return {
                warnings: [],
                persistedCase: params.caseValue,
                ...emptySnapshots(),
            };
        }
        const { warnings, caseValue, ...snapshotsForWrite } = await this.execute(params);
        return { warnings, persistedCase: caseValue, ...snapshotsForWrite };
    }

    /**
     * Adds write-time stale warnings when a snapshot-conditional UPDATE matched no row.
     *
     * @param {Array<{ code: string, message: string }>} warnings
     * @param {object} persistedCase
     * @param {object} [updateResult]
     */
    static applyWriteOutcome(warnings, persistedCase, updateResult = {}) {
        for (const { field, code, writeFlag } of STALE_FIELDS) {
            if (!updateResult[writeFlag]) {
                continue;
            }
            delete persistedCase[field];
            if (!warnings.some((warning) => warning.code === code)) {
                warnings.push({ code, message: STALE_SNAPSHOT_MESSAGE });
            }
        }
    }

    /**
     * @param {Array<{ code: string, message: string }>} warnings
     * @returns {{ warnings: Array<{ code: string, message: string }> }|undefined}
     */
    static httpData(warnings) {
        return warnings.length ? { warnings } : undefined;
    }
}
