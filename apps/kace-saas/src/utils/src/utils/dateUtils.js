import { format, formatISO, parse, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const timezone = import.meta.env.VITE_TIMEZONE || "UTC";
/*
 * Intentional: formatTableDateTime and convertTimestamps display dates in the user's browser time
 * zone, not the build-time VITE_TIMEZONE held in `timezone`.
 */
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const DATE_FIELDS = ["created_at", "updated_at", "fecha_resolucion"];

export const TABLE_DATE_TIME_FORMAT = "dd/MM/yyyy HH:mm:ss";

/**
 * Converts a date to the configured timezone
 * @param {Date|string} date - Date to convert
 * @returns {Date} Date in the configured timezone
 */
export const toLocalTimezone = (date) => {
    const parsedDate = typeof date === "string" ? parseISO(date) : date;
    return toZonedTime(parsedDate, timezone);
};

/**
 * Converts a date from the local timezone to UTC
 * @param {Date|string} date - Date to convert
 * @returns {Date} Date in UTC
 */
export const toUTC = (date) => {
    const parsedDate = typeof date === "string" ? parseISO(date) : date;
    return toZonedTime(parsedDate, "UTC");
};

const parseToDate = (date) => {
    if (date instanceof Date) return date;
    if (typeof date === "number") return new Date(date);
    if (typeof date !== "string") return new Date(NaN);

    const isoParsed = parseISO(date);
    if (!Number.isNaN(isoParsed.getTime())) return isoParsed;

    return new Date(date);
};

/**
 * Formats a date according to the specified format in the configured timezone
 * @param {Date|string} date - Date to format
 * @param {string} formatStr - Desired format (e.g., "yyyy-MM-dd HH:mm:ss")
 * @returns {string} Formatted date
 */
export const formatDate = (date, formatStr = "yyyy-MM-dd HH:mm:ss") => {
    if (!date || date === "null" || date === "undefined") return "";
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return "";
    return format(parsed, formatStr, { timeZone: timezone });
};

/**
 * Formats a value for table datetime cells using the shared display pattern.
 * Leaves already-localized dd/MM/yyyy HH:mm:ss values untouched.
 * @param {Date|string|number|null|undefined} value
 * @returns {string}
 */
export const formatTableDateTime = (value) => {
    if (value === null || value === undefined || value === "" || value === "null" || value === "undefined") {
        return "";
    }

    if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(value)) {
        return value;
    }

    const parsed = parseToDate(value);
    if (Number.isNaN(parsed.getTime())) return "";
    try {
        return formatInTimeZone(parsed, TIMEZONE, TABLE_DATE_TIME_FORMAT);
    } catch {
        return format(parsed, TABLE_DATE_TIME_FORMAT);
    }
};

/**
 * Formats a date to an ISO string in the configured timezone
 * @param {Date|string} date - Date to format
 * @returns {string} Date in ISO string format
 */
export const formatToISO = (date) => {
    const zonedDate = toLocalTimezone(date);
    return formatISO(zonedDate, { timeZone: timezone });
};

/**
 * Parses a date string to the configured timezone
 * @param {string} dateStr - Date string to parse
 * @param {string} formatStr - Format of the string (e.g., "yyyy-MM-dd HH:mm:ss")
 * @returns {Date} Parsed date
 */
export const parseDate = (dateStr, formatStr = "yyyy-MM-dd HH:mm:ss") => {
    return parse(dateStr, formatStr, new Date(), { timeZone: timezone });
};

/**
 * Gets the configured timezone
 * @returns {string} Current timezone
 */
export const getCurrentTimezone = () => timezone;

export const convertTimestamps = (data) => {
    if (!data || typeof data !== "object") return data;

    if (Array.isArray(data)) {
        return data.map((item) => convertTimestamps(item));
    }

    return Object.keys(data).reduce((acc, key) => {
        if (DATE_FIELDS.includes(key) && data[key]) {
            try {
                const parsed = parseToDate(data[key]);
                if (Number.isNaN(parsed.getTime())) {
                    acc[key] = data[key];
                } else {
                    acc[key] = formatInTimeZone(parsed, TIMEZONE, "yyyy-MM-dd HH:mm:ssXXX");
                }
            } catch {
                // NO-SONAR: Si ocurre un error al formatear la fecha, se devuelve el valor original sin modificar.
                acc[key] = data[key];
            }
        } else if (data[key] !== null && typeof data[key] === "object" && !(data[key] instanceof Date)) {
            acc[key] = convertTimestamps(data[key]);
        } else {
            acc[key] = data[key];
        }
        return acc;
    }, {});
};
