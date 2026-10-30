import { comparatorFunctions } from '../../../../src/shared/calculator/functions/comparatorFunctions';

describe('comparatorFunctions', () => {
    describe('eq', () => {
        it('returns true when values are strictly equal', () => {
            expect(comparatorFunctions.eq(1, 1)).toBe(true);
            expect(comparatorFunctions.eq('a', 'a')).toBe(true);
        });

        it('returns false when values are not strictly equal', () => {
            expect(comparatorFunctions.eq(1, '1')).toBe(false);
            expect(comparatorFunctions.eq(true, false)).toBe(false);
        });
    });

    describe('ne', () => {
        it('returns true when values are not strictly equal', () => {
            expect(comparatorFunctions.ne(1, '1')).toBe(true);
            expect(comparatorFunctions.ne(true, false)).toBe(true);
        });

        it('returns false when values are strictly equal', () => {
            expect(comparatorFunctions.ne(1, 1)).toBe(false);
            expect(comparatorFunctions.ne('a', 'a')).toBe(false);
        });
    });

    describe('gt', () => {
        it('returns true when first value is greater', () => {
            expect(comparatorFunctions.gt(5, 3)).toBe(true);
            expect(comparatorFunctions.gt('b', 'a')).toBe(true);
            expect(comparatorFunctions.gt(new Date(2025, 1, 1), new Date(2024, 1, 1))).toBe(true);
        });

        it('returns false otherwise', () => {
            expect(comparatorFunctions.gt(3, 5)).toBe(false);
            expect(comparatorFunctions.gt('a', 'b')).toBe(false);
        });
    });

    describe('gte', () => {
        it('returns true when first value is greater or equal', () => {
            expect(comparatorFunctions.gte(5, 3)).toBe(true);
            expect(comparatorFunctions.gte(5, 5)).toBe(true);
        });

        it('returns false when first value is less', () => {
            expect(comparatorFunctions.gte(2, 3)).toBe(false);
        });
    });

    describe('lt', () => {
        it('returns true when first value is less', () => {
            expect(comparatorFunctions.lt(2, 3)).toBe(true);
            expect(comparatorFunctions.lt('a', 'b')).toBe(true);
        });

        it('returns false otherwise', () => {
            expect(comparatorFunctions.lt(3, 2)).toBe(false);
            expect(comparatorFunctions.lt('b', 'a')).toBe(false);
        });
    });

    describe('lte', () => {
        it('returns true when first value is less or equal', () => {
            expect(comparatorFunctions.lte(2, 3)).toBe(true);
            expect(comparatorFunctions.lte(3, 3)).toBe(true);
        });

        it('returns false when first value is greater', () => {
            expect(comparatorFunctions.lte(5, 3)).toBe(false);
        });
    });

    describe('and', () => {
        it('returns true if all values are truthy', () => {
            expect(comparatorFunctions.and(true, 1, 'non-empty')).toBe(true);
        });

        it('returns false if any value is falsy', () => {
            expect(comparatorFunctions.and(true, false, true)).toBe(false);
            expect(comparatorFunctions.and(true, 0, true)).toBe(false);
        });
    });

    describe('or', () => {
        it('returns true if at least one value is truthy', () => {
            expect(comparatorFunctions.or(false, true, false)).toBe(true);
            expect(comparatorFunctions.or(0, 'yes', false)).toBe(true);
        });

        it('returns false if all values are falsy', () => {
            expect(comparatorFunctions.or(false, 0, null)).toBe(false);
        });
    });

    describe('not', () => {
        it('returns true if value is falsy', () => {
            expect(comparatorFunctions.not(false)).toBe(true);
            expect(comparatorFunctions.not(0)).toBe(true);
            expect(comparatorFunctions.not(null)).toBe(true);
        });

        it('returns false if value is truthy', () => {
            expect(comparatorFunctions.not(true)).toBe(false);
            expect(comparatorFunctions.not(1)).toBe(false);
            expect(comparatorFunctions.not('text')).toBe(false);
        });
    });
});
