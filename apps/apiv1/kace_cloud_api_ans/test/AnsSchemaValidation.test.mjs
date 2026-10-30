import { createSchema, updateSchema } from '../src/schemas.mjs';
import {
    DEFAULT_ANS_VISUAL_COLORS,
    SHARED_VISUAL_COLOR_ALLOWLIST,
} from '@kace/core/src/shared/visual-options/sharedVisualOptions.js';

const validAnsPayload = {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Ans visual',
    intermedio: 5,
    vencido: 10,
    color_ans_inicial: DEFAULT_ANS_VISUAL_COLORS.initial,
    color_ans_intermedio: DEFAULT_ANS_VISUAL_COLORS.intermediate,
    color_ans_final: DEFAULT_ANS_VISUAL_COLORS.final,
    medicion_ans_id: 'Days',
    status: 1,
    created_at: Date.now(),
    created_by: '11111111-1111-4111-8111-111111111111',
};

describe('ANS schema visual allowlists', () => {
    it('accepts allowlisted ANS colors on create', () => {
        expect(createSchema.validate(validAnsPayload).error).toBeUndefined();
    });

    it('requires every ANS color on create (no silent default backfill)', () => {
        const payloadWithoutInitialColor = { ...validAnsPayload };
        delete payloadWithoutInitialColor.color_ans_inicial;
        const { error, value } = createSchema.validate(payloadWithoutInitialColor);

        expect(error).toBeDefined();
        expect(error.message).toContain('color_ans_inicial');
        expect(value.color_ans_inicial).toBeUndefined();
    });

    it('rejects manipulated ANS colors on create', () => {
        const { error } = createSchema.validate({
            ...validAnsPayload,
            color_ans_inicial: '#FFFFFF',
        });

        expect(error).toBeDefined();
    });

    it('rejects manipulated ANS colors on update', () => {
        const { error } = updateSchema.validate({
            color_ans_inicial: SHARED_VISUAL_COLOR_ALLOWLIST[0],
            color_ans_intermedio: '#FFFFFF',
            updated_at: new Date(),
            updated_by: '11111111-1111-4111-8111-111111111111',
        });

        expect(error).toBeDefined();
    });
});
