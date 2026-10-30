import { SQLInjectionDictionary } from "./SQLInjectionDictionary";
import { XSSDictionary } from "./XSSDictionary";

/**
 * Verifica si un valor está libre de patrones de SQL Injection.
 * @param {string} value
 * @returns {boolean}
 */
export function isSafeFromSQLInjection (value) {
    if (typeof value !== "string") return true;
    const detected = SQLInjectionDictionary.findSQLInjectionPatterns(value);
    return detected.length === 0;
}

/**
 * Verifica si un valor está libre de patrones de XSS.
 * @param {string} value
 * @returns {boolean}
 */
export function isSafeFromXSS (value) {
    if (typeof value !== "string") return true;
    const detected = XSSDictionary.findXSSPatterns(value);
    return detected.length === 0;
}

/**
 * Valida si una cadena de texto es segura contra SQL Injection y XSS.
 * @param {string} value
 * @returns {boolean}
 */
export function isStringSecure (value) {
    return isSafeFromSQLInjection(value) && isSafeFromXSS(value);
}
