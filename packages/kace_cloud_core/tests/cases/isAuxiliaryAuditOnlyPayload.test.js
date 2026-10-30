import { isAuxiliaryAuditOnlyPayload } from '../../src/cases/application/isAuxiliaryAuditOnlyPayload.js';

describe('isAuxiliaryAuditOnlyPayload', () => {
    it('is true for empty case plus audit timestamps and empty aux', () => {
        expect(
            isAuxiliaryAuditOnlyPayload({
                case: { updated_at: '2026-01-01', updated_by: 'u1' },
                aux_cases: {},
            })
        ).toBe(true);
    });

    it('is false when a domain key is present', () => {
        expect(
            isAuxiliaryAuditOnlyPayload({
                case: { updated_at: 'x', updated_by: 'u', cliente_id: 'c1' },
                aux_cases: {},
            })
        ).toBe(false);
    });

    it('is false when aux_cases has keys', () => {
        expect(isAuxiliaryAuditOnlyPayload({ case: {}, aux_cases: { id: 'a' } })).toBe(false);
    });

    it('is false when description is present', () => {
        expect(
            isAuxiliaryAuditOnlyPayload({ case: {}, aux_cases: {}, description: { id: 'd', descripcion: '' } })
        ).toBe(false);
    });
});
