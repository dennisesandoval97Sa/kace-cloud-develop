import { StatesCreateSchema, StatesUpdateSchema } from '../src/StateSchema.mjs';
import {
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from '@kace/core/src/shared/visual-options/sharedVisualOptions.js';

const validStatePayload = {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Estado visual',
    descripcion: 'Estado con opciones visuales permitidas',
    icon_class: SHARED_VISUAL_ICON_ALLOWLIST[0],
    status: 1,
    color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
    require_observation: false,
};

describe('State schema visual allowlists', () => {
    it('accepts allowlisted icon and color values on create', () => {
        expect(StatesCreateSchema.validate(validStatePayload).error).toBeUndefined();
    });

    it('rejects manipulated icon values on create', () => {
        const { error } = StatesCreateSchema.validate({ ...validStatePayload, icon_class: 'check' });

        expect(error).toBeDefined();
    });

    it('rejects manipulated color values on update', () => {
        const { error } = StatesUpdateSchema.validate({
            color: '#FFFFFF',
            updated_at: Date.now(),
            updated_by: '11111111-1111-4111-8111-111111111111',
        });

        expect(error).toBeDefined();
    });
});
