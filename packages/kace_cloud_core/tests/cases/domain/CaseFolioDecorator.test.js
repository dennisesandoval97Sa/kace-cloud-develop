import { CaseFolioDecorator } from '../../../src/cases/domain/services/CaseFolioDecorator';

describe('CaseFolioDecorator', () => {
    describe('decorate', () => {
        it('should generate folio with correct length padding', () => {
            const result = CaseFolioDecorator.decorate('M20260119', 4, 1);
            expect(result).toBe('M202601190001');
        });

        it('should handle double-digit numbers correctly', () => {
            const result = CaseFolioDecorator.decorate('M20260119', 4, 10);
            expect(result).toBe('M202601190010');
        });

        it('should handle triple-digit numbers correctly', () => {
            const result = CaseFolioDecorator.decorate('M20260119', 4, 123);
            expect(result).toBe('M202601190123');
        });

        it('should handle four-digit numbers at maximum', () => {
            const result = CaseFolioDecorator.decorate('M20260119', 4, 9999);
            expect(result).toBe('M202601199999');
        });

        it('should truncate when number exceeds folio length', () => {
            const result = CaseFolioDecorator.decorate('M20260119', 4, 10000);
            expect(result).toBe('M202601190000');
        });

        it('should truncate when number exceeds folio length with larger numbers', () => {
            const result = CaseFolioDecorator.decorate('M20260119', 4, 12345);
            expect(result).toBe('M202601192345');
        });

        it('should return null when external code is null', () => {
            const result = CaseFolioDecorator.decorate(null, 4, 1);
            expect(result).toBe(null);
        });

        it('should return empty string when external code is empty string', () => {
            const result = CaseFolioDecorator.decorate('', 4, 5);
            expect(result).toBe('');
        });

        it('should handle different folio lengths', () => {
            expect(CaseFolioDecorator.decorate('PREFIX', 6, 1)).toBe('PREFIX000001');
            expect(CaseFolioDecorator.decorate('PREFIX', 3, 1)).toBe('PREFIX001');
            expect(CaseFolioDecorator.decorate('PREFIX', 8, 42)).toBe('PREFIX00000042');
        });
    });
});
