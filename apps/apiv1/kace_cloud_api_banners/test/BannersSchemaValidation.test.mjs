import { BannersCreateSchema, BannersUpdateSchema } from '../src/BannersSchema.mjs';
import {
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from '@kace/core/src/shared/visual-options/sharedVisualOptions.js';

const validBannerPayload = {
    id: '11111111-1111-4111-8111-111111111111',
    descripcion: 'Banner visual permitido',
    propiedades: {
        position: 'top-center',
        icon: SHARED_VISUAL_ICON_ALLOWLIST[0],
        color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
        siteToShow: 'admin',
    },
    especificaciones: {
        users: null,
        groups: ['11111111-1111-4111-8111-111111111111'],
        clients: null,
    },
    fecha_inicio: '2026-01-01',
    fecha_fin: '2026-01-02',
    status: 1,
    created_at: Date.now(),
    created_by: '11111111-1111-4111-8111-111111111111',
};

describe('Banner schema visual allowlists', () => {
    it('accepts allowlisted icon and color values on create', () => {
        expect(BannersCreateSchema.validate(validBannerPayload).error).toBeUndefined();
    });

    it('rejects manipulated icon values on create', () => {
        const { error } = BannersCreateSchema.validate({
            ...validBannerPayload,
            propiedades: { ...validBannerPayload.propiedades, icon: 'check' },
        });

        expect(error).toBeDefined();
    });

    it('rejects manipulated color values on update', () => {
        const { error } = BannersUpdateSchema.validate({
            propiedades: { color: '#FFFFFF' },
            updated_at: '2026-01-03T00:00:00.000Z',
            updated_by: '11111111-1111-4111-8111-111111111111',
        });

        expect(error).toBeDefined();
    });
});
