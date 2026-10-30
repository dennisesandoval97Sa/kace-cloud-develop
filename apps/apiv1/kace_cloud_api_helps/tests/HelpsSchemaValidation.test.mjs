import { SHARED_VISUAL_COLOR_ALLOWLIST } from '@kace/core/src/shared/visual-options/sharedVisualOptions.js';
import { HelpsCreateSchema, HelpsUpdateSchema } from '../src/HelpsSchema.mjs';

const validHelpPayload = {
    id: '11111111-1111-4111-8111-111111111111',
    titulo: 'Ayuda visible',
    descripcion: 'Contenido suficientemente largo para pasar la validación.',
    color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
    is_active: true,
    created_at: Date.now(),
    created_by: '11111111-1111-4111-8111-111111111111',
};

describe('Help schema visual allowlists', () => {
    it('accepts allowlisted color values on create', () => {
        expect(HelpsCreateSchema.validate(validHelpPayload).error).toBeUndefined();
    });

    it('rejects manipulated color values on create', () => {
        const { error } = HelpsCreateSchema.validate({ ...validHelpPayload, color: '#FFFFFF' });

        expect(error).toBeDefined();
    });

    it('rejects manipulated color values on update', () => {
        const { error } = HelpsUpdateSchema.validate({
            color: '#FFFFFF',
            updated_at: new Date(),
            updated_by: '11111111-1111-4111-8111-111111111111',
        });

        expect(error).toBeDefined();
    });
});
