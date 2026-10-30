import { casoReOpenSchema } from '../src/schemas.mjs';

const commentId = '11111111-1111-4111-8111-111111111111';
const transitionId = '22222222-2222-4222-8222-222222222222';

describe('casoReOpenSchema', () => {
    it('requires comment or the deprecated comment id', () => {
        const { error } = casoReOpenSchema.validate({ transicion_id: transitionId });

        expect(error).toBeDefined();
        expect(error.details.some((detail) => detail.type === 'object.missing')).toBe(true);
    });

    it('accepts only comment descripcion from the client', () => {
        const { error, value } = casoReOpenSchema.validate({
            transicion_id: transitionId,
            comment: {
                descripcion: 'Reabrir el caso',
            },
        });

        expect(error).toBeUndefined();
        expect(value.comment).toEqual({
            descripcion: 'Reabrir el caso',
        });
    });

    it('accepts the deprecated cambio_estado_comentario_id without comment', () => {
        const { error, value } = casoReOpenSchema.validate({
            transicion_id: transitionId,
            cambio_estado_comentario_id: commentId,
        });

        expect(error).toBeUndefined();
        expect(value.cambio_estado_comentario_id).toBe(commentId);
        expect(value.comment).toBeUndefined();
    });

    it('rejects sending comment and cambio_estado_comentario_id together', () => {
        const { error } = casoReOpenSchema.validate({
            transicion_id: transitionId,
            comment: { descripcion: 'Reabrir el caso' },
            cambio_estado_comentario_id: commentId,
        });

        expect(error).toBeDefined();
        expect(error.details.some((detail) => detail.type === 'object.xor')).toBe(true);
    });

    it('rejects a client-supplied comment id inside comment', () => {
        const { error } = casoReOpenSchema.validate({
            transicion_id: transitionId,
            comment: {
                id: commentId,
                descripcion: 'Reabrir el caso',
            },
        });

        expect(error).toBeDefined();
        expect(error.details.some((detail) => detail.path.includes('id'))).toBe(true);
    });
});
