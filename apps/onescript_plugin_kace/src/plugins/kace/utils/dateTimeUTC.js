export function toUTCISOString(val) {
  if (val == null || val === '') return val;
  if (val instanceof Date)
    return Number.isFinite(val.getTime()) ? val.toISOString() : val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isFinite(d.getTime()) ? d.toISOString() : val;
  }
  return val;
}

export function normalizeIncomingUTC(val) {
  if (val == null || val === '') return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (!trimmed) return val;
  if (/Z$/i.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.replace(/(\.\d{3})?$/, (m) => m || '.000') + 'Z';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed + 'T00:00:00.000Z';
  return trimmed;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Format a UTC/ISO date string for display (e.g. "2026-01-08T13:42:00.525Z" or "2026-01-27T12:00:00-05:00").
 * @param {string} [iso] - UTC/ISO date string
 * @param {{ timeStyle?: 'short' | 'medium' | 'long' }} [opts] - `timeStyle: 'medium'` includes seconds in most locales.
 * @returns {string} Formatted date/time or '—' if invalid
 */
export function formatUTCForDisplay(iso, opts = {}) {
  const timeStyle = opts.timeStyle ?? 'short';
  if (iso == null || iso === '') return '—';
  const s = typeof iso === 'string' ? iso.trim() : String(iso);
  if (!s) return '—';
  if (!ISO_DATE_REGEX.test(s) && !/Z$/i.test(s)) return '—';
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '—';
  try {
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle });
  } catch {
    return s;
  }
}

/**
 * Check if a value looks like an ISO date string.
 * @param {*} val
 * @returns {boolean}
 */
export function looksLikeISODate(val) {
  if (val == null || typeof val !== 'string') return false;
  const s = val.trim();
  return ISO_DATE_REGEX.test(s) || /Z$/i.test(s);
}
