import {
    charLimitKey,
    getCharLimitIssue,
    isMaxBelowMin,
    parseCharLimitKey,
} from '../../src/global-config/domain/settings/clientFieldCharLimits.js';

describe('clientFieldCharLimits', () => {
    describe('charLimitKey / parseCharLimitKey', () => {
        it('round-trips a field with underscores in its name', () => {
            expect(charLimitKey('tipo_documento', 'max')).toBe('field_tipo_documento_max');
            expect(parseCharLimitKey('field_tipo_documento_max')).toEqual({ field: 'tipo_documento', bound: 'max' });
        });

        it.each(['field_documento_required', 'documento_min', 'field__min_extra'])('rejects %s', (key) => {
            expect(parseCharLimitKey(key)).toBeNull();
        });
    });

    describe('getCharLimitIssue', () => {
        it.each([undefined, null, '', '  ', 0, '0', 5, '10'])('accepts %p', (value) => {
            expect(getCharLimitIssue(value)).toBeNull();
        });

        it.each([
            ['abc', 'not_a_number'],
            [true, 'not_a_number'],
            [{}, 'not_a_number'],
            [2.5, 'not_integer'],
            ['10.5', 'not_integer'],
            [-1, 'negative'],
            ['-20', 'negative'],
        ])('flags %p as %s', (value, issue) => {
            expect(getCharLimitIssue(value)).toBe(issue);
        });
    });

    describe('isMaxBelowMin', () => {
        it.each([
            [2, 1],
            ['10', '9'],
        ])('is true for min=%p max=%p', (min, max) => {
            expect(isMaxBelowMin(min, max)).toBe(true);
        });

        it.each([
            [10, 10],
            ['9', '10'],
            [5, 0],
            ['', 5],
            [5, ''],
            [null, 5],
            [2.5, 2],
            [2, -1],
        ])('is false for min=%p max=%p', (min, max) => {
            expect(isMaxBelowMin(min, max)).toBe(false);
        });
    });
});
