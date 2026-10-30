import { clampPageSize, MAX_PAGE_SIZE } from '../../../../src/cases/application/search/clampPageSize.js';

describe('clampPageSize', () => {
    it('returns the default max when limit is null', () => {
        // Arrange
        const limit = null;

        // Act
        const result = clampPageSize(limit);

        // Assert
        expect(result).toBe(MAX_PAGE_SIZE);
    });

    it('returns the default max when limit is undefined', () => {
        expect(clampPageSize(undefined)).toBe(MAX_PAGE_SIZE);
    });

    it('returns the default max when limit is 0', () => {
        expect(clampPageSize(0)).toBe(MAX_PAGE_SIZE);
    });

    it('returns the default max when limit is negative', () => {
        expect(clampPageSize(-5)).toBe(MAX_PAGE_SIZE);
    });

    it('caps a limit greater than the max to the max', () => {
        expect(clampPageSize(99999)).toBe(MAX_PAGE_SIZE);
    });

    it('keeps a valid limit within range', () => {
        expect(clampPageSize(25)).toBe(25);
    });

    it('keeps a limit equal to the max', () => {
        expect(clampPageSize(MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE);
    });

    it('floors a non-integer limit', () => {
        expect(clampPageSize(25.9)).toBe(25);
    });

    it('returns the max for a non-numeric limit', () => {
        expect(clampPageSize('abc')).toBe(MAX_PAGE_SIZE);
    });

    it('exposes MAX_PAGE_SIZE as 100', () => {
        expect(MAX_PAGE_SIZE).toBe(100);
    });
});
