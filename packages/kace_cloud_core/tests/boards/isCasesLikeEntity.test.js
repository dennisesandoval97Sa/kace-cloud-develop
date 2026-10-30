import { BULK_REQUIRED_COLUMNS, isCasesLikeEntity } from '../../src/boards/domain/isCasesLikeEntity.js';

describe('isCasesLikeEntity', () => {
    it('returns true for the real cases table', () => {
        expect(isCasesLikeEntity('cases')).toBe(true);
    });

    it('returns true for board views containing cases or casos', () => {
        expect(isCasesLikeEntity('boards_cases_open')).toBe(true);
        expect(isCasesLikeEntity('boards_casos_abiertos')).toBe(true);
        expect(isCasesLikeEntity('boards_MyCases')).toBe(true);
    });

    it('returns false for non cases-like entities', () => {
        expect(isCasesLikeEntity('clients')).toBe(false);
        expect(isCasesLikeEntity('aux_something')).toBe(false);
        expect(isCasesLikeEntity('boards_clientes')).toBe(false);
        expect(isCasesLikeEntity(null)).toBe(false);
        expect(isCasesLikeEntity(undefined)).toBe(false);
        expect(isCasesLikeEntity('')).toBe(false);
    });

    it('exposes the required bulk columns contract', () => {
        expect(BULK_REQUIRED_COLUMNS).toEqual(['id', 'fecha_resolucion', 'transicion_id']);
    });
});
