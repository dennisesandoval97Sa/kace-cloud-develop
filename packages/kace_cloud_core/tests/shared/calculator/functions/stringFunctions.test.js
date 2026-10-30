import { stringFunctions } from '../../../../src/shared/calculator/functions/stringFunctions';

describe('stringFunctions', () => {
    describe('concat', () => {
        test('concatenates multiple strings', () => {
            expect(stringFunctions.concat('Hello', ' ', 'World')).toBe('Hello World');
            expect(stringFunctions.concat('a', 'b', 'c')).toBe('abc');
            expect(stringFunctions.concat('')).toBe('');
        });
    });

    describe('upper', () => {
        test('converts string to uppercase', () => {
            expect(stringFunctions.upper('hello')).toBe('HELLO');
            expect(stringFunctions.upper('HeLLo')).toBe('HELLO');
            expect(stringFunctions.upper(123)).toBe('123');
        });
    });

    describe('lower', () => {
        test('converts string to lowercase', () => {
            expect(stringFunctions.lower('HELLO')).toBe('hello');
            expect(stringFunctions.lower('HeLLo')).toBe('hello');
            expect(stringFunctions.lower(123)).toBe('123');
        });
    });

    describe('trim', () => {
        test('trims whitespace from both ends', () => {
            expect(stringFunctions.trim('  hello  ')).toBe('hello');
            expect(stringFunctions.trim('\n\tworld\t\n')).toBe('world');
            expect(stringFunctions.trim(123)).toBe('123');
        });
    });

    describe('slice', () => {
        test('returns substring from i to j', () => {
            expect(stringFunctions.slice('Hello World', 0, 5)).toBe('Hello');
            expect(stringFunctions.slice('Hello World', 6)).toBe('World');
            expect(stringFunctions.slice('abc', 1, 2)).toBe('b');
            expect(stringFunctions.slice(12345, 1, 3)).toBe('23');
        });
    });
});
