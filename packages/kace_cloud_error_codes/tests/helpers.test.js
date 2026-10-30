import { describe, expect, it } from '@jest/globals';
import {
    PUBLIC_ERROR_CODE_PATTERN,
    normalizePublicErrorCode,
    findPublicErrorCode,
    getPublicErrorCodeName,
    isKnownPublicErrorCode,
    getPublicErrorCodeI18nKey,
} from '../index.js';

describe('public error code helpers', () => {
    it('exposes the decimal 0x pattern', () => {
        expect(PUBLIC_ERROR_CODE_PATTERN.test('0x030010')).toBe(true);
        expect(PUBLIC_ERROR_CODE_PATTERN.test('0x03000A')).toBe(false);
        expect(PUBLIC_ERROR_CODE_PATTERN.test('030001')).toBe(false);
    });

    it('normalizes trimmed canonical codes', () => {
        expect(normalizePublicErrorCode(' 0x030001 ')).toBe('0x030001');
    });

    it('rejects non-canonical shapes', () => {
        expect(normalizePublicErrorCode('0x03000A')).toBeUndefined();
        expect(normalizePublicErrorCode('0x03000f')).toBeUndefined();
        expect(normalizePublicErrorCode('0X030001')).toBeUndefined();
        expect(normalizePublicErrorCode('030001')).toBeUndefined();
        expect(normalizePublicErrorCode('0x0C0001')).toBeUndefined();
        expect(normalizePublicErrorCode('')).toBeUndefined();
        expect(normalizePublicErrorCode(null)).toBeUndefined();
        expect(normalizePublicErrorCode(0x030001)).toBeUndefined();
    });

    it('finds the first well-formed code even if unknown', () => {
        expect(findPublicErrorCode('nope', '0x999999', '0x030001')).toBe('0x999999');
        expect(findPublicErrorCode('0x03000A', '030001')).toBeUndefined();
    });

    it('resolves known names and i18n keys', () => {
        expect(getPublicErrorCodeName('0x030029')).toBe('BOARD_BULK_ACTIONS_INCOMPATIBLE');
        expect(isKnownPublicErrorCode('0x030029')).toBe(true);
        expect(getPublicErrorCodeI18nKey('0x030029', 'app.errors.public')).toBe(
            'app.errors.public.BOARD_BULK_ACTIONS_INCOMPATIBLE'
        );
        expect(getPublicErrorCodeI18nKey('0x030029', 'app.public.errors')).toBe(
            'app.public.errors.BOARD_BULK_ACTIONS_INCOMPATIBLE'
        );
        expect(getPublicErrorCodeI18nKey('0x030029')).toBeUndefined();
        expect(getPublicErrorCodeI18nKey('0x030029', '')).toBeUndefined();
        expect(getPublicErrorCodeName('0x999999')).toBeUndefined();
        expect(isKnownPublicErrorCode('0x999999')).toBe(false);
        expect(getPublicErrorCodeI18nKey('0x999999', 'app.errors.public')).toBeUndefined();
    });
});
