import Joi from 'joi';

const base = {
    descripcion: Joi.string().min(3).max(5000),
    calificacion: Joi.number().integer().min(1).max(10).allow(null),
    caso_id: Joi.string().uuid().required(),
};

export const CommentsCreateSchema = Joi.object({
    ...base,
    id: Joi.string().uuid().required(),
    descripcion: base.descripcion.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const CommentsUpdateSchema = Joi.object({
    descripcion: base.descripcion,
    calificacion: base.calificacion,
    updated_at: Joi.date().timestamp().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
