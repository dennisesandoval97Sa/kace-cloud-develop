import { ArrayMerger } from '../../../../src/shared/domain/utilities/ArrayMerger.js';
import { ValidationFailError } from '../../../../src/shared/index.js';

describe('ArrayMerger', () => {
    describe('merge()', () => {
        it('should merge arrays with primitive values without duplicates', () => {
            const current = ['a', 'b', 'c'];
            const newItems = ['c', 'd'];
            const expected = ['a', 'b', 'c', 'd'];

            const result = ArrayMerger.merge(current, newItems);

            expect(result).toEqual(expected);
        });

        it('should merge arrays with objects without duplicates', () => {
            const current = [{ name: 'John' }, { name: 'Jane' }];
            const newItems = [{ name: 'Jane' }, { name: 'Bob' }];
            const expected = [{ name: 'John' }, { name: 'Jane' }, { name: 'Bob' }];

            const result = ArrayMerger.merge(current, newItems);

            expect(result).toEqual(expected);
        });

        it('should throw ValidationFailError for non-array inputs', () => {
            expect(() => ArrayMerger.merge('not-array', [])).toThrow(ValidationFailError);
            expect(() => ArrayMerger.merge([], 'not-array')).toThrow(ValidationFailError);
            expect(() => ArrayMerger.merge(null, [])).toThrow(ValidationFailError);
        });

        it('should handle empty arrays', () => {
            expect(ArrayMerger.merge([], ['a'])).toEqual(['a']);
            expect(ArrayMerger.merge(['a'], [])).toEqual(['a']);
            expect(ArrayMerger.merge([], [])).toEqual([]);
        });

        it('should not mutate original arrays', () => {
            const original1 = ['a', 'b'];
            const original2 = ['c', 'd'];

            ArrayMerger.merge(original1, original2);

            expect(original1).toEqual(['a', 'b']);
            expect(original2).toEqual(['c', 'd']);
        });

        it('should handle null and undefined values correctly', () => {
            const current = ['a', null, undefined];
            const newItems = [null, undefined, 'b'];
            const expected = ['a', null, undefined, 'b'];

            const result = ArrayMerger.merge(current, newItems);

            expect(result).toEqual(expected);
        });

        it('should merge complex nested objects', () => {
            const current = [{ user: { id: 1, profile: { name: 'John' } } }];
            const newItems = [
                { user: { id: 1, profile: { name: 'John' } } },
                { user: { id: 2, profile: { name: 'Jane' } } },
            ];
            const expected = [
                { user: { id: 1, profile: { name: 'John' } } },
                { user: { id: 2, profile: { name: 'Jane' } } },
            ];

            const result = ArrayMerger.merge(current, newItems);

            expect(result).toEqual(expected);
        });
    });

    describe('mergeMultiple()', () => {
        it('should merge multiple arrays', () => {
            const result = ArrayMerger.mergeMultiple(['a'], ['b', 'a'], ['c', 'd']);
            expect(result).toEqual(['a', 'b', 'c', 'd']);
        });

        it('should return empty array for no arguments', () => {
            expect(ArrayMerger.mergeMultiple()).toEqual([]);
        });

        it('should throw TypeError for invalid arrays in mergeMultiple', () => {
            expect(() => ArrayMerger.mergeMultiple(['a'], 'not-array', ['c'])).toThrow(TypeError);
            expect(() => ArrayMerger.mergeMultiple(['a'], null, ['c'])).toThrow(TypeError);
        });

        it('should handle single array in mergeMultiple', () => {
            const result = ArrayMerger.mergeMultiple(['a', 'b', 'c']);
            expect(result).toEqual(['a', 'b', 'c']);
        });

        it('should merge multiple object arrays', () => {
            const arr1 = [{ id: 1, name: 'John' }];
            const arr2 = [
                { id: 1, name: 'John' },
                { id: 2, name: 'Jane' },
            ];
            const arr3 = [{ id: 3, name: 'Bob' }];
            const expected = [
                { id: 1, name: 'John' },
                { id: 2, name: 'Jane' },
                { id: 3, name: 'Bob' },
            ];

            const result = ArrayMerger.mergeMultiple(arr1, arr2, arr3);

            expect(result).toEqual(expected);
        });

        it('should preserve order when merging multiple arrays', () => {
            const result = ArrayMerger.mergeMultiple(['z'], ['a', 'b'], ['c'], ['a', 'd']);
            expect(result).toEqual(['z', 'a', 'b', 'c', 'd']);
        });
    });

    describe('addValue()', () => {
        it('should add single primitive value without duplicates', () => {
            const current = ['a', 'b', 'c'];
            const expected = ['a', 'b', 'c', 'd'];

            const result = ArrayMerger.addValue(current, 'd');

            expect(result).toEqual(expected);
        });

        it('should not add duplicate primitive value', () => {
            const current = ['a', 'b', 'c'];
            const expected = ['a', 'b', 'c'];

            const result = ArrayMerger.addValue(current, 'b');

            expect(result).toEqual(expected);
        });

        it('should add single object value', () => {
            const current = [{ name: 'John' }];
            const expected = [{ name: 'John' }, { name: 'Jane' }];

            const result = ArrayMerger.addValue(current, { name: 'Jane' });

            expect(result).toEqual(expected);
        });

        it('should not add duplicate object value', () => {
            const current = [{ name: 'John' }];
            const expected = [{ name: 'John' }];

            const result = ArrayMerger.addValue(current, { name: 'John' });

            expect(result).toEqual(expected);
        });

        it('should throw ValidationFailError for non-array input', () => {
            expect(() => ArrayMerger.addValue('not-array', 'value')).toThrow(ValidationFailError);
            expect(() => ArrayMerger.addValue(null, 'value')).toThrow(ValidationFailError);
            expect(() => ArrayMerger.addValue(undefined, 'value')).toThrow(ValidationFailError);
        });

        it('should not mutate original array', () => {
            const original = ['a', 'b', 'c'];
            const originalCopy = [...original];

            ArrayMerger.addValue(original, 'd');

            expect(original).toEqual(originalCopy);
        });

        it('should handle adding null and undefined values', () => {
            const current = ['a', 'b'];

            const resultWithNull = ArrayMerger.addValue(current, null);
            expect(resultWithNull).toEqual(['a', 'b', null]);

            const resultWithUndefined = ArrayMerger.addValue(current, undefined);
            expect(resultWithUndefined).toEqual(['a', 'b', undefined]);

            const resultDuplicateNull = ArrayMerger.addValue(['a', null], null);
            expect(resultDuplicateNull).toEqual(['a', null]);
        });

        it('should handle adding complex nested objects', () => {
            const current = [{ user: { id: 1, name: 'John' } }];
            const newValue = { user: { id: 2, name: 'Jane' } };
            const expected = [{ user: { id: 1, name: 'John' } }, { user: { id: 2, name: 'Jane' } }];

            const result = ArrayMerger.addValue(current, newValue);

            expect(result).toEqual(expected);
        });

        it('should handle adding numbers, booleans, and other primitives', () => {
            let current = [];

            let result = ArrayMerger.addValue(current, 42);
            expect(result).toEqual([42]);

            result = ArrayMerger.addValue(result, true);
            expect(result).toEqual([42, true]);

            result = ArrayMerger.addValue(result, false);
            expect(result).toEqual([42, true, false]);

            result = ArrayMerger.addValue(result, 42);
            expect(result).toEqual([42, true, false]);
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle arrays with mixed data types', () => {
            const current = ['string', 42, true, { key: 'value' }, null, undefined];
            const newItems = [42, false, { key: 'value' }, 'new string'];
            const expected = ['string', 42, true, { key: 'value' }, null, undefined, false, 'new string'];

            const result = ArrayMerger.merge(current, newItems);

            expect(result).toEqual(expected);
        });

        it('should handle objects that cannot be JSON.stringified', () => {
            const obj1 = { name: 'test' };
            obj1.self = obj1;

            const obj2 = { name: 'test2' };

            const current = [obj1];
            const result = ArrayMerger.addValue(current, obj2);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(obj1);
            expect(result[1]).toEqual(obj2);
        });

        it('should validate ValidationFailError messages and field names', () => {
            try {
                ArrayMerger.merge('invalid', []);
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationFailError);
                expect(error.message).toContain('Expected currentArray to be an array');
                expect(error.field).toBe('currentArray');
            }

            try {
                ArrayMerger.addValue(123, 'value');
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationFailError);
                expect(error.message).toContain('Expected currentArray to be an array');
                expect(error.field).toBe('currentArray');
            }
        });

        it('should handle large arrays efficiently', () => {
            const largeArray1 = Array.from({ length: 1000 }, (_, i) => i);
            const largeArray2 = Array.from({ length: 500 }, (_, i) => i + 1000);

            const start = performance.now();
            const result = ArrayMerger.merge(largeArray1, largeArray2);
            const end = performance.now();

            expect(result).toHaveLength(1500);
            expect(end - start).toBeLessThan(100);
        });
    });
});
