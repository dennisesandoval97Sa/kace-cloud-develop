/**
 * User-facing copy for the Event Log component.
 */
export const EVENT_LOG_FIELD_PATH_NOT_COMPARABLE =
  'Este campo no está presente en ambos estados (anterior y nuevo) de este evento; no se puede comparar.';

/** Matches dynamic row markers in `fieldPath` (`[]`, `[*]`, `{rowIndex}`). */
export const EVENT_LOG_DYNAMIC_ROW_PATH_PATTERN = /\[\]|\[\*\]|\{rowIndex\}/;

/**
 * Store key used across Kace to know if the current session is editing an existing case (not create).
 * @see useSchema.js, submit/index.js
 */
export const EVENT_LOG_STORE_KEY_CASE_ID = 'cases.case_id';

/**
 * Dot-path prefix for per-instance event log session cache (KaceEngine storeService).
 * Each instance uses `getEventLogSessionStorePath`.
 */
export const EVENT_LOG_STORE_SESSIONS_PREFIX = 'event_log.sessions';

/**
 * Builds a stable store path for one Event Log Form.io instance. Unsafe characters in `instanceKey`
 * are replaced so StoreService `get` path parsing works.
 *
 * @param {string} [instanceKey]
 * @returns {string}
 */
export function getEventLogSessionStorePath(instanceKey) {
  const raw = String(instanceKey ?? '').trim();
  const safe = (raw.length > 0 ? raw : 'unknown').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  return `${EVENT_LOG_STORE_SESSIONS_PREFIX}.${safe}`;
}
