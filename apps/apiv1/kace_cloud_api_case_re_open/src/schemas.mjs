import Joi from 'joi';

/**
 * Clients should send `comment.descripcion`. The comment id is assigned by the server.
 * `cambio_estado_comentario_id` is deprecated and will be removed in the next major version.
 */
export const casoReOpenSchema = Joi.object({
    comment: Joi.object({
        descripcion: Joi.string().min(3).max(5000).required(),
    }),
    // DEPRECATED: remove in the next major version; use `comment`.
    cambio_estado_comentario_id: Joi.string().uuid(),
    transicion_id: Joi.string().uuid().optional(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
}).xor('comment', 'cambio_estado_comentario_id');
