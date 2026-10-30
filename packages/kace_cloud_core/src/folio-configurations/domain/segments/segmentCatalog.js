/**
 * Vocabulary of a folio configuration: the single source of truth for the domain, the API
 * schema and the configuration screen in kace-saas.
 *
 * Pure on purpose — no imports — so the front can import it through the `@kace/core` alias
 * without pulling dayjs, RuleValidator or the rest of the domain into the bundle.
 */

export const SEGMENT_TYPES = ['literal', 'date', 'field', 'sequence'];

/**
 * Closed whitelist of dayjs tokens. A free-form format string would let a configuration
 * smuggle in quoted literals and silently change the width of the folio.
 */
export const DATE_FORMATS = [
    'YYYY',
    'YY',
    'MM',
    'M',
    'DD',
    'D',
    'YYYYMM',
    'YYMM',
    'YYYYMMDD',
    'YYMMDD',
    'MMDD',
    'HH',
    'mm',
    'ss',
];

/**
 * Formats that always render with the same width. `M` and `D` drop the leading zero, so
 * their width depends on the date and they cannot anchor a position inside the folio.
 */
export const FIXED_WIDTH_DATE_FORMATS = DATE_FORMATS.filter((format) => format !== 'M' && format !== 'D');

/**
 * Calendar units each fixed-width format renders. A periodic reset needs its units in the
 * folio, otherwise the numbering restarts on top of folios already issued.
 */
export const DATE_FORMAT_UNITS = {
    YYYY: ['Y'],
    YY: ['Y'],
    MM: ['M'],
    DD: ['D'],
    YYYYMM: ['Y', 'M'],
    YYMM: ['Y', 'M'],
    YYYYMMDD: ['Y', 'M', 'D'],
    YYMMDD: ['Y', 'M', 'D'],
    MMDD: ['M', 'D'],
};

export const RESET_REQUIRED_UNITS = {
    yearly: ['Y'],
    monthly: ['Y', 'M'],
    daily: ['Y', 'M', 'D'],
};

/**
 * Paths that RuleValidator.getFieldValue rewrites before resolving them:
 * `clasificaciones.description` -> `clasificaciones.id` and `cases.estadoActual` -> `estados.id`.
 * A rule only compares the result, so the rewrite is invisible there. A folio renders it, so
 * the first would embed a 36-character UUID in the radicado and the second resolves against
 * `estados`, which the creation-time context leaves empty — every case would fail.
 */
export const UNRESOLVABLE_PATHS = ['clasificaciones.description', 'cases.estadoActual'];

/** Context roots FolioCaseContextBuilder populates when the case is created. */
export const RESOLVABLE_ROOTS = ['cases', 'aux_cases', 'clasificaciones'];

/** `folio_sequences.current_value` and `start_value` are int4. */
export const MAX_SEQUENCE_LENGTH = 9;
export const MAX_START_VALUE = 2147483647;

/** Digits of the widest number the int4 counter can hold: how far `grow` can widen the consecutive. */
export const MAX_COUNTER_DIGITS = 10;

/** Width of `cases.folio`. */
export const MAX_FOLIO_LENGTH = 100;

export const RESET_POLICIES = ['never', 'yearly', 'monthly', 'daily', 'prefix'];

export const OVERFLOW_POLICIES = ['fail', 'grow'];
