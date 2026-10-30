import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const RANGE_SPLIT = /, /;
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;
const OUTPUT = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX";

const extractCalendarDate = (part) => {
    const trimmed = String(part ?? "").trim();
    const match = trimmed.match(DATE_PREFIX);
    return match ? match[1] : null;
};

const isValidCalendarDate = (dateStr) => {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1000) return false;
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;

    const date = new Date(Date.UTC(2000, 0, 1));
    date.setUTCFullYear(year, month - 1, day);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const formatBound = (calendarDate, wallTime, timeZone) => {
    const utcDate = fromZonedTime(`${calendarDate}T${wallTime}`, timeZone);
    return formatInTimeZone(utcDate, timeZone, OUTPUT);
};

const formatStartBound = (calendarDate, timeZone) => {
    const midnight = formatBound(calendarDate, "00:00:00.000", timeZone);
    if (midnight.startsWith(calendarDate)) return midnight;

    return formatBound(calendarDate, "01:00:00.000", timeZone);
};

const normalizeDateMode = (startPart, endPart, timeZone) => {
    const startDay = extractCalendarDate(startPart);
    const endDay = extractCalendarDate(endPart ?? startPart);
    if (!startDay || !endDay) return null;
    if (!isValidCalendarDate(startDay) || !isValidCalendarDate(endDay)) return null;
    if (endDay < startDay) return null;

    try {
        const start = formatStartBound(startDay, timeZone);
        const end = formatBound(endDay, "23:59:59.999", timeZone);
        return `${start}, ${end}`;
    } catch {
        return null;
    }
};

const normalizeDatetimeMode = (startPart, endPart, timeZone) => {
    const startInstant = new Date(String(startPart).trim());
    const endInstant = new Date(String(endPart ?? startPart).trim());
    if (Number.isNaN(startInstant.getTime()) || Number.isNaN(endInstant.getTime())) return null;
    if (endInstant.getTime() < startInstant.getTime()) return null;

    const start = formatInTimeZone(startInstant, timeZone, OUTPUT);
    const end = formatInTimeZone(endInstant, timeZone, OUTPUT);
    return `${start}, ${end}`;
};

/**
 * @param {string} value
 * @param {string} timeZone IANA timezone
 * @param {{ mode?: 'date' | 'datetime' }} [options]
 * @returns {string|null}
 */
export const normalizeTableDateRangeFilter = (value, timeZone, options = {}) => {
    if (value === null || value === undefined || value === "") return null;
    if (!timeZone || typeof timeZone !== "string") {
        throw new Error("normalizeTableDateRangeFilter: timeZone is required");
    }

    try {
        Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    } catch {
        throw new Error(`normalizeTableDateRangeFilter: invalid timeZone "${timeZone}"`);
    }

    const mode = options.mode === "datetime" ? "datetime" : "date";
    const [startPart, endPart] = String(value).split(RANGE_SPLIT);

    return mode === "datetime"
        ? normalizeDatetimeMode(startPart, endPart, timeZone)
        : normalizeDateMode(startPart, endPart, timeZone);
};
