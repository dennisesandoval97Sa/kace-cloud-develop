import { PUBLIC_ERROR_CODE_NAMES_BY_CODE } from './catalog.js';

/** `0x` is a published prefix, not hex encoding. Digits must be 0-9. */
export const PUBLIC_ERROR_CODE_PATTERN = /^0x\d{6}$/;

export function normalizePublicErrorCode(code) {
    if (typeof code !== 'string') {
        return undefined;
    }

    const trimmedCode = code.trim();
    return PUBLIC_ERROR_CODE_PATTERN.test(trimmedCode) ? trimmedCode : undefined;
}

/** First well-formed `0x`+6 decimal digits. Does not require catalog membership. */
export function findPublicErrorCode(...codes) {
    for (const code of codes) {
        const normalizedCode = normalizePublicErrorCode(code);
        if (normalizedCode) {
            return normalizedCode;
        }
    }

    return undefined;
}

export function getPublicErrorCodeName(code) {
    const normalizedCode = normalizePublicErrorCode(code);
    return normalizedCode ? PUBLIC_ERROR_CODE_NAMES_BY_CODE[normalizedCode] : undefined;
}

export function isKnownPublicErrorCode(code) {
    return Boolean(getPublicErrorCodeName(code));
}

export function getPublicErrorCodeI18nKey(code, namespace) {
    const codeName = getPublicErrorCodeName(code);
    if (!codeName || typeof namespace !== 'string' || namespace.length === 0) {
        return undefined;
    }
    return `${namespace}.${codeName}`;
}
