import { parseActiveClientId } from '../../src/boards/domain/parseActiveClientId.js';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('parseActiveClientId', () => {
    it('returns a valid UUID unchanged', () => {
        expect(parseActiveClientId(UUID)).toBe(UUID);
    });

    it('trims surrounding whitespace before validating', () => {
        expect(parseActiveClientId(`  ${UUID}  `)).toBe(UUID);
    });

    it('returns null for missing values', () => {
        expect(parseActiveClientId(undefined)).toBeNull();
        expect(parseActiveClientId(null)).toBeNull();
        expect(parseActiveClientId('')).toBeNull();
        expect(parseActiveClientId('   ')).toBeNull();
    });

    it('returns null for non-strings and non-UUID strings', () => {
        expect(parseActiveClientId(123)).toBeNull();
        expect(parseActiveClientId('not-a-uuid')).toBeNull();
        expect(parseActiveClientId('11111111-1111-4111-8111-11111111111')).toBeNull();
    });
});
