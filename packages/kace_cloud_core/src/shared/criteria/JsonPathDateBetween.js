import { TenantContext } from '../infrastructure/context/TenantContext.js';

const PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BOUND_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/;
const MAX_OFFSET_HOURS = 14;

const daysInMonth = (year, month) => {
    const date = new Date(Date.UTC(2000, 0, 1));
    date.setUTCFullYear(year, month, 0);
    return date.getUTCDate();
};

const isValidCalendarDate = (year, month, day) =>
    year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);

/**
 * Bounds must be full ISO date-times with an explicit offset, so the range is a pair of exact
 * instants and never depends on the server or session timezone.
 */
const isValidBound = (value) => {
    const match = typeof value === 'string' ? BOUND_PATTERN.exec(value) : null;
    if (!match) return false;

    const [year, month, day, hour, minute, second, offsetHour = 0, offsetMinute = 0] = match
        .slice(1)
        .map((part) => (part === undefined ? undefined : Number(part)));
    return (
        isValidCalendarDate(year, month, day) &&
        hour <= 23 &&
        minute <= 59 &&
        second <= 59 &&
        offsetHour <= MAX_OFFSET_HOURS &&
        offsetMinute <= 59
    );
};

const parseJson = (value) => {
    if (value !== null && typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

/**
 * Stored values are whatever `PeriodSchema` accepted: date-only or date-time, with or without
 * offset. Every cast is behind a shape and range check (nested CASE keeps the evaluation order),
 * so a malformed row yields NULL instead of failing the query. Values without offset are read in
 * the tenant timezone, the same way `KnexReportsViewRepository` interpreted them to build the report;
 * the bounds keep the caller's offset, so a day-range from a browser in another timezone can shift them.
 */
const STORED_DATE_TO_TIMESTAMPTZ = `(SELECT CASE
    WHEN v.s ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6}){0,1}(Z|[+-][0-9]{2}:[0-9]{2}){0,1}){0,1}$' THEN
        CASE WHEN substring(v.s, 1, 4)::int >= 1 AND substring(v.s, 6, 2)::int BETWEEN 1 AND 12 THEN
            CASE WHEN substring(v.s, 9, 2)::int BETWEEN 1 AND EXTRACT(DAY FROM make_date(substring(v.s, 1, 4)::int, substring(v.s, 6, 2)::int, 1) + INTERVAL '1 month - 1 day')
                AND (CASE WHEN length(v.s) = 10 THEN true
                    ELSE substring(v.s, 12, 2)::int <= 23 AND substring(v.s, 15, 2)::int <= 59 AND substring(v.s, 18, 2)::int <= 59 END)
                AND (CASE WHEN v.s ~ '[+-][0-9]{2}:[0-9]{2}$'
                    THEN substring(v.s FROM '([0-9]{2}):[0-9]{2}$')::int <= ${MAX_OFFSET_HOURS} AND right(v.s, 2)::int <= 59
                    ELSE true END)
            THEN
                CASE WHEN v.s ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN v.s::timestamptz ELSE v.s::timestamp AT TIME ZONE ? END
            END
        END
    END
FROM (SELECT ??->>? AS s) AS v)`;

/**
 * Parses and validates a `jsonPathDateBetween` filter value: a JSON string (or object)
 * `{ path, from, to }` where `path` is a top-level key of the JSONB column.
 *
 * @param {string|object} rawValue
 * @returns {{ path: string, from: string, to: string }}
 */
export const parseJsonPathDateBetweenValue = (rawValue) => {
    const { path, from, to } = parseJson(rawValue) ?? {};
    if (typeof path !== 'string' || !PATH_PATTERN.test(path) || !isValidBound(from) || !isValidBound(to)) {
        throw new Error('Invalid JsonPathDateBetween value');
    }

    return { path, from, to };
};

/**
 * Builds the `whereRaw`/`orWhereRaw` arguments that keep the rows whose `field->>path` date
 * falls within `[from, to]`.
 *
 * @param {string} field - JSONB column
 * @param {{ path: string, from: string, to: string }} value - Output of `parseJsonPathDateBetweenValue`
 * @returns {[string, Array<string>]}
 */
export const buildJsonPathDateBetweenClause = (field, { path, from, to }) => {
    const timezone = TenantContext.getTenant()?.timezone?.value ?? 'UTC';

    return [
        `${STORED_DATE_TO_TIMESTAMPTZ} BETWEEN ?::timestamptz AND ?::timestamptz`,
        [timezone, field, path, from, to],
    ];
};
