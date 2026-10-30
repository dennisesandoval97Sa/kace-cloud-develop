import { BetweenParser } from '../../../src/shared/criteria/BetweenParser';

describe('BetweenParser - parse', () => {
    it('should return the same array if value is already an array', () => {
        const input = ['A', 'B'];
        const result = BetweenParser.parse(input);

        expect(result).toBe(input); // misma referencia
        expect(result).toEqual(['A', 'B']);
    });

    it('should split a comma-separated string into an array', () => {
        const input = 'A,B';
        const result = BetweenParser.parse(input);

        expect(result).toEqual(['A', 'B']);
    });

    it('should trim spaces when splitting string', () => {
        const input = '  A  ,   B   ';
        const result = BetweenParser.parse(input);

        expect(result).toEqual(['A', 'B']);
    });

    it('should handle multiple values in string', () => {
        const input = 'A,B,C,D';
        const result = BetweenParser.parse(input);

        expect(result).toEqual(['A', 'B', 'C', 'D']);
    });

    it('should remove empty values after split', () => {
        const input = 'A,,B, ,C,';
        const result = BetweenParser.parse(input);

        expect(result).toEqual(['A', 'B', 'C']);
    });

    it('should return empty array for empty string', () => {
        const input = '';
        const result = BetweenParser.parse(input);

        expect(result).toEqual([]);
    });

    it('should return empty array for string with only commas and spaces', () => {
        const input = ' , ,   , ';
        const result = BetweenParser.parse(input);

        expect(result).toEqual([]);
    });

    it('should return empty array for null', () => {
        const result = BetweenParser.parse(null);

        expect(result).toEqual([]);
    });

    it('should return empty array for undefined', () => {
        const result = BetweenParser.parse(undefined);

        expect(result).toEqual([]);
    });

    it('should return empty array for non-string and non-array values', () => {
        expect(BetweenParser.parse(123)).toEqual([]);
        expect(BetweenParser.parse({})).toEqual([]);
        expect(BetweenParser.parse(true)).toEqual([]);
    });

    it('should handle date strings correctly', () => {
        const input = '2025-01-01, 2025-12-31';
        const result = BetweenParser.parse(input);

        expect(result).toEqual(['2025-01-01', '2025-12-31']);
    });

    it('should handle ISO date strings with time', () => {
        const input = '2025-01-01T00:00:00.000Z,2025-12-31T23:59:59.999Z';
        const result = BetweenParser.parse(input);

        expect(result).toEqual(['2025-01-01T00:00:00.000Z', '2025-12-31T23:59:59.999Z']);
    });
});
