/**
 * SSOT for the character limits of the client form
 * (`settings.layouts.application.agente.clients.fields_max_min`), validated on
 * both the backend (Layouts domain) and the frontend (General Setup form Joi
 * schema and inputs).
 *
 * Keep this file dependency-free so the frontend can import it directly.
 */

export const CHAR_LIMIT_KEY_PATTERN = /^field_(.+)_(min|max)$/;

/** @param {'min'|'max'} bound */
export const charLimitKey = (field, bound) => `field_${field}_${bound}`;

/** @returns {{ field: string, bound: 'min'|'max' } | null} */
export const parseCharLimitKey = (key) => {
    const match = CHAR_LIMIT_KEY_PATTERN.exec(key);
    return match ? { field: match[1], bound: match[2] } : null;
};

const isUnset = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const toNumber = (value) => (typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN);

/**
 * Why a stored limit is unusable, or null when it is unset or a valid
 * non-negative integer.
 * @returns {null | 'not_a_number' | 'not_integer' | 'negative'}
 */
export const getCharLimitIssue = (value) => {
    if (isUnset(value)) {
        return null;
    }

    const limit = toNumber(value);

    if (Number.isNaN(limit)) {
        return 'not_a_number';
    }

    if (!Number.isInteger(limit)) {
        return 'not_integer';
    }

    return limit < 0 ? 'negative' : null;
};

/**
 * Cross-field rule, only meaningful once both limits are individually valid.
 * A max of 0 means "no limit" for every consumer (useAgentFormConfig,
 * GlobalValidationService), so it never conflicts with the min.
 */
export const isMaxBelowMin = (min, max) => {
    if (isUnset(min) || isUnset(max) || getCharLimitIssue(min) || getCharLimitIssue(max)) {
        return false;
    }

    const maxLimit = toNumber(max);
    return maxLimit !== 0 && maxLimit < toNumber(min);
};
