import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { ValidationFailError } from '../../errors/ValidationFailError.js';
import { TenantContext } from '../../infrastructure/context/TenantContext.js';

dayjs.extend(utc);
dayjs.extend(timezone);
const fallbackTimezone = 'America/Bogota';

/**
 * Normaliza el valor recibido para que `dayjs` lo interprete correctamente.
 * Acepta:
 * - ISO strings (`"2025-10-31T00:00:00Z"`)
 * - timestamps numéricos (`1761329400000`)
 * - "2025-10-31"
 *
 * @param {string|number|Date} value
 * @returns {number|string|Date}
 */
function normalizeDateInput(value) {
    if (typeof value === 'string' && /^\d+$/.test(value)) {
        return Number(value);
    }
    // Strings solo-fecha ('2025-10-17') se interpretan como hora local sin zona horaria,
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${value}T00:00:00`;
    }
    return value;
}

/**
 * Convierte una fecha UTC a la zona horaria local del tenant.
 * Usar solo en bordes del sistema (responses, presentación).
 * @param {string|Date|dayjs.Dayjs} utcDate
 * @returns {dayjs.Dayjs}
 */
export function fromUTCToLocal(utcDate) {
    const input = normalizeDateInput(utcDate);
    if (!isValidDate(input)) {
        throw new ValidationFailError(`Invalid date value for fromUTCToLocal: ${utcDate}`);
    }

    const TIME_ZONE = TenantContext.getTenant()?.timezone?.value || fallbackTimezone;
    return dayjs.utc(input).tz(TIME_ZONE);
}

/**
 * Convierte una fecha local a UTC.
 * Usar solo en bordes del sistema (recepción de datos del API).
 * @param {string|number|Date} localDate - Fecha en zona local del tenant
 * @returns {dayjs.Dayjs}
 */
export function fromLocalToUTC(localDate) {
    const input = normalizeDateInput(localDate);
    if (!isValidDate(input)) {
        throw new ValidationFailError(`Invalid date value for fromLocalToUTC: ${localDate}`);
    }
    const TIME_ZONE = TenantContext.getTenant()?.timezone?.value || fallbackTimezone;
    return dayjs.tz(input, TIME_ZONE).utc();
}

/**
 * Verifica si el valor proporcionado es una fecha válida.
 * @param {any} value
 * @returns {boolean}
 */
function isValidDate(value) {
    const input = normalizeDateInput(value);
    return dayjs(input).isValid();
}

/**
 * Detecta si el valor ya contiene zona horaria (Z, +/-offset) o es un timestamp numérico.
 * @param {any} value
 * @returns {boolean}
 */
function hasTimezoneSuffix(value) {
    return typeof value === 'number' || (typeof value === 'string' && /([Zz]|[+-]\d{2}(:\d{2})?)$/.test(value.trim()));
}

/**
 * Parsea una fecha respetando la zona horaria embebida o usando la proporcionada.
 * - Si la fecha ya contiene zona horaria (Z, +/-offset) o es un timestamp numérico,
 *   se parsea y convierte a modo UTC.
 * - Si no contiene zona y se proporciona timezone, se interpreta en esa zona.
 * - Si no contiene zona y no se proporciona timezone, se asume UTC.
 * @param {string|number|Date} date
 * @param {string} [timezone]
 * @returns {dayjs.Dayjs}
 */
function parseDate(date, timezone) {
    const normalized = normalizeDateInput(date);
    const hasTz = hasTimezoneSuffix(normalized);
    let input;
    try {
        if (hasTz) {
            input = dayjs(normalized).utc();
        } else if (timezone) {
            input = dayjs.tz(normalized, timezone);
        } else {
            input = dayjs.utc(normalized);
        }
    } catch {
        throw new ValidationFailError(`Invalid date: ${date}`);
    }
    if (!input.isValid()) {
        throw new ValidationFailError(`Invalid date: ${date}`);
    }
    return input;
}

/**
 * Formatea la salida de una fecha.
 * - Si se proporcionó timezone, la salida se convierte a esa zona horaria.
 * - Si no, la salida es UTC (ISO string con Z).
 * @param {dayjs.Dayjs} dayjsObj
 * @param {string} [timezone]
 * @returns {string}
 */
function formatOutput(dayjsObj, timezone) {
    if (timezone) {
        return dayjsObj.tz(timezone).format('YYYY-MM-DDTHH:mm:ss.SSSZ');
    }
    return dayjsObj.toISOString();
}

/**
 * Valida que n sea un número válido.
 * @param {any} n
 * @param {string} fnName
 */
function validateNumber(n, fnName) {
    if (typeof n !== 'number' || isNaN(n)) {
        throw new ValidationFailError(`Invalid number in ${fnName}: ${n}`);
    }
}

export function addDays(date, n, timezone) {
    const input = parseDate(date, timezone);
    validateNumber(n, 'addDays');
    return formatOutput(input.add(n, 'day'), timezone);
}

export function addMonths(date, n, timezone) {
    const input = parseDate(date, timezone);
    validateNumber(n, 'addMonths');
    return formatOutput(input.add(n, 'month'), timezone);
}

export function addYears(date, n, timezone) {
    const input = parseDate(date, timezone);
    validateNumber(n, 'addYears');
    return formatOutput(input.add(n, 'year'), timezone);
}

export function subDays(date, n, timezone) {
    const input = parseDate(date, timezone);
    validateNumber(n, 'subDays');
    return formatOutput(input.add(-n, 'day'), timezone);
}

export function subMonths(date, n, timezone) {
    validateNumber(n, 'subMonths');
    return addMonths(date, -n, timezone);
}

export function subYears(date, n, timezone) {
    validateNumber(n, 'subYears');
    return addYears(date, -n, timezone);
}

export function startOfMonth(date, timezone) {
    const input = parseDate(date, timezone);
    return formatOutput(input.startOf('month'), timezone);
}

export function endOfMonth(date, timezone) {
    const input = parseDate(date, timezone);
    return formatOutput(input.endOf('month'), timezone);
}

export function diffDays(a, b, timezone) {
    const inputA = parseDate(a, timezone);
    const inputB = parseDate(b, timezone);
    return inputA.diff(inputB, 'day');
}

export function addHours(date, n, timezone) {
    const input = parseDate(date, timezone);
    validateNumber(n, 'addHours');
    return formatOutput(input.add(n, 'hour'), timezone);
}

export function addMinutes(date, n, timezone) {
    const input = parseDate(date, timezone);
    validateNumber(n, 'addMinutes');
    return formatOutput(input.add(n, 'minute'), timezone);
}

export function subHours(date, n, timezone) {
    validateNumber(n, 'subHours');
    return addHours(date, -n, timezone);
}

export function subMinutes(date, n, timezone) {
    validateNumber(n, 'subMinutes');
    return addMinutes(date, -n, timezone);
}

export function now() {
    return dayjs.utc().toISOString();
}

export const dateFunctions = {
    addDays,
    addMonths,
    addYears,
    subDays,
    subMonths,
    subYears,
    startOfMonth,
    endOfMonth,
    diffDays,
    addHours,
    addMinutes,
    subHours,
    subMinutes,
    now,
};
