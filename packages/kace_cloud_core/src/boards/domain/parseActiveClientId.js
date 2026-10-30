import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid.js';

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
export function parseActiveClientId(raw) {
    if (typeof raw !== 'string') {
        return null;
    }
    const value = raw.trim();
    if (!ValueObjectUuid.isValidUuid(value)) {
        return null;
    }
    return value;
}
