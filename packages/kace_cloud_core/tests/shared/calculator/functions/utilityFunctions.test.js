import { utilityFunctions } from '../../../../src/shared/calculator/functions/utilityFunctions';

describe('utilityFunctions', () => {
    describe('ref', () => {
        it('throws error when called', () => {
            expect(() => utilityFunctions.ref()).toThrow(Error);
            expect(() => utilityFunctions.ref()).toThrow('ref() is not initialized');
        });
    });

    describe('coalesce', () => {
        it('returns the first non-null/undefined value', () => {
            expect(utilityFunctions.coalesce(null, undefined, 0, 5)).toBe(0);
            expect(utilityFunctions.coalesce(undefined, null, 'a', 'b')).toBe('a');
            expect(utilityFunctions.coalesce(null, undefined)).toBeUndefined();
            expect(utilityFunctions.coalesce(1, 2, 3)).toBe(1);
        });
    });

    describe('iif', () => {
        it('returns a if condition is true, otherwise b', () => {
            expect(utilityFunctions.iif(true, 'yes', 'no')).toBe('yes');
            expect(utilityFunctions.iif(false, 'yes', 'no')).toBe('no');
            expect(utilityFunctions.iif(1 > 0, 123, 456)).toBe(123);
            expect(utilityFunctions.iif(0 > 1, 'a', 'b')).toBe('b');
        });
    });

    describe('len', () => {
        it('returns the length of the string representation', () => {
            expect(utilityFunctions.len('hello')).toBe(5);
            expect(utilityFunctions.len(12345)).toBe(5);
            expect(utilityFunctions.len(true)).toBe(4);
        });
    });
});
