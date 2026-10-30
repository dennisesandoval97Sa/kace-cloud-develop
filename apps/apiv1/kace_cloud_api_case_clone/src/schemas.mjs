import Joi from 'joi';

export const caseCloneSchema = Joi.object({
    id: Joi.string().uuid().required(),
    comment: Joi.object({
        id: Joi.string().uuid().required(),
        descripcion: Joi.string().min(3).max(5000).required(),
        calificacion: Joi.number().integer().min(1).max(10).allow(null),
        caso_id: Joi.string().uuid().optional(),
        created_at: Joi.date().timestamp().allow(null),
        created_by: Joi.string().uuid().allow(null),
    }).optional(),
    transicion_id: Joi.string().uuid().allow(''),
    grupo_id: Joi.string().uuid().allow(''),
    responsable_id: Joi.string().uuid().allow(''),
});
