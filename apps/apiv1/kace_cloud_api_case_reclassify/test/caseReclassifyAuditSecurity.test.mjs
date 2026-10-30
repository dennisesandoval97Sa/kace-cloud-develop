import { describe, expect, it } from '@jest/globals';
import { caseReclassifySchema } from '../src/schemas.mjs';
import { applyServerManagedFields } from '@kace/api-common';

const CLASSIFICATION_ID = '22222222-2222-4222-8222-222222222222';
const TRANSITION_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';

describe('caseReclassifySchema audit fields security', () => {
    it('accepts valid reclassify payload without edited fields', () => {
        const payload = {
            clasificacion_id: CLASSIFICATION_ID,
            transicion_id: TRANSITION_ID,
            comment: { descripcion: 'Motivo de la reclasificación' },
            updated_at: new Date(),
            updated_by: USER_ID,
        };
        const { error, value } = caseReclassifySchema.validate(payload);
        expect(error).toBeUndefined();
        expect(value.clasificacion_id).toBe(CLASSIFICATION_ID);
        expect(value.transicion_id).toBe(TRANSITION_ID);
    });

    it('rejects payload with unexpected edited_at or edited_by', () => {
        const payload = {
            clasificacion_id: CLASSIFICATION_ID,
            transicion_id: TRANSITION_ID,
            comment: { descripcion: 'Motivo de la reclasificación' },
            edited_at: new Date(),
            edited_by: USER_ID,
        };
        const { error } = caseReclassifySchema.validate(payload);
        expect(error).toBeDefined();
        expect(error.details.some((d) => d.message.includes('edited_at') || d.message.includes('edited_by'))).toBe(
            true
        );
    });

    it('applyServerManagedFields purges spoofed edited_by and edited_at', () => {
        const spoofedPayload = {
            clasificacion_id: CLASSIFICATION_ID,
            transicion_id: TRANSITION_ID,
            edited_by: '00000000-0000-0000-0000-000000000001',
            edited_at: '2020-01-01T00:00:00.000Z',
            created_by: '00000000-0000-0000-0000-000000000001',
        };
        const sanitized = applyServerManagedFields(spoofedPayload, {
            operation: 'update',
            userId: USER_ID,
            now: new Date('2026-09-12T10:00:00.000Z'),
        });

        expect(sanitized.edited_by).toBeUndefined();
        expect(sanitized.edited_at).toBeUndefined();
        expect(sanitized.created_by).toBeUndefined();
        expect(sanitized.updated_by).toBe(USER_ID);
        expect(sanitized.updated_at).toEqual(new Date('2026-09-12T10:00:00.000Z'));
    });
});
