import { enabledStaleFields, isCaseStaleCheckEnabled } from '../../src/cases/domain/isCaseStaleCheckEnabled.js';
import { STALE_FIELDS } from '../../src/cases/domain/staleFields.js';

describe('isCaseStaleCheckEnabled', () => {
    it('uses case_stale_check when the key is present', () => {
        expect(isCaseStaleCheckEnabled({ case_stale_check: true, transition_stale_check: false })).toBe(true);
        expect(isCaseStaleCheckEnabled({ case_stale_check: false, transition_stale_check: true })).toBe(false);
    });

    it('ORs legacy flags when case_stale_check is absent', () => {
        expect(isCaseStaleCheckEnabled({ transition_stale_check: true })).toBe(true);
        expect(isCaseStaleCheckEnabled({ responsable_stale_check: true })).toBe(true);
        expect(isCaseStaleCheckEnabled({})).toBe(false);
    });

    it('treats null as omitted so legacy flags still apply', () => {
        expect(isCaseStaleCheckEnabled({ case_stale_check: null, transition_stale_check: true })).toBe(true);
        expect(enabledStaleFields({ case_stale_check: null, transition_stale_check: true })).toEqual(['transicion_id']);
    });
});

describe('enabledStaleFields', () => {
    it('enables all five fields when case_stale_check is true', () => {
        expect(enabledStaleFields({ case_stale_check: true })).toEqual([
            'transicion_id',
            'responsable_id',
            'cliente_id',
            'clasificacion_id',
            'grupo_id',
        ]);
    });

    it('el gate cubre todos los campos de la tabla declarativa', () => {
        expect(enabledStaleFields({ case_stale_check: true })).toEqual(STALE_FIELDS.map((entry) => entry.field));
    });

    it('returns no fields when case_stale_check is false', () => {
        expect(enabledStaleFields({ case_stale_check: false, transition_stale_check: true })).toEqual([]);
    });

    it('keeps only legacy fields when the unified key is omitted', () => {
        expect(enabledStaleFields({ transition_stale_check: true, responsable_stale_check: true })).toEqual([
            'transicion_id',
            'responsable_id',
        ]);
        expect(enabledStaleFields({ transition_stale_check: true })).toEqual(['transicion_id']);
        expect(enabledStaleFields({})).toEqual([]);
    });
});
