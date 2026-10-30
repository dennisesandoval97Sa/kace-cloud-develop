import { describe, expect, it } from '@jest/globals';
import { schemaUpdate } from '../src/schemas.mjs';

describe('schemaUpdate stale snapshots', () => {
    it('accepts current_responsable_id as uuid', () => {
        const { error, value } = schemaUpdate.validate({
            current_responsable_id: '11111111-1111-1111-1111-111111111111',
        });
        expect(error).toBeUndefined();
        expect(value.current_responsable_id).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('accepts current_responsable_id null', () => {
        const { error, value } = schemaUpdate.validate({ current_responsable_id: null });
        expect(error).toBeUndefined();
        expect(value.current_responsable_id).toBeNull();
    });

    it('rejects current_responsable_id that is not a uuid', () => {
        const { error } = schemaUpdate.validate({ current_responsable_id: 'not-a-uuid' });
        expect(error).toBeDefined();
    });

    it('still accepts current_transicion_id', () => {
        const { error, value } = schemaUpdate.validate({
            current_transicion_id: '22222222-2222-2222-2222-222222222222',
        });
        expect(error).toBeUndefined();
        expect(value.current_transicion_id).toBe('22222222-2222-2222-2222-222222222222');
    });

    it('accepts current_cliente_id as uuid or null', () => {
        const uuid = '33333333-3333-3333-3333-333333333333';
        expect(schemaUpdate.validate({ current_cliente_id: uuid }).error).toBeUndefined();
        expect(schemaUpdate.validate({ current_cliente_id: null }).error).toBeUndefined();
    });

    it('accepts current_clasificacion_id as uuid or null', () => {
        const uuid = '44444444-4444-4444-4444-444444444444';
        expect(schemaUpdate.validate({ current_clasificacion_id: uuid }).error).toBeUndefined();
        expect(schemaUpdate.validate({ current_clasificacion_id: null }).error).toBeUndefined();
    });

    it('accepts current_grupo_id as uuid or null', () => {
        const uuid = '55555555-5555-5555-5555-555555555555';
        expect(schemaUpdate.validate({ current_grupo_id: uuid }).error).toBeUndefined();
        expect(schemaUpdate.validate({ current_grupo_id: null }).error).toBeUndefined();
    });

    it('accepts edited_by and edited_at', () => {
        const editorId = '33333333-3333-4333-8333-333333333333';
        const editedAt = new Date().toISOString();
        const { error, value } = schemaUpdate.validate({
            edited_by: editorId,
            edited_at: editedAt,
        });
        expect(error).toBeUndefined();
        expect(value.edited_by).toBe(editorId);
        expect(new Date(value.edited_at).toISOString()).toBe(new Date(editedAt).toISOString());
    });
});
