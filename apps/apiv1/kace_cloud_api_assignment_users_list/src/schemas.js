import Joi from 'joi';

const usuarioSchema = Joi.object({
    id: Joi.string().uuid().required(),
});

const base = {
    descripcion: Joi.string().min(3),
    lista_usuarios: Joi.array().items(usuarioSchema),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    group_id: Joi.string().uuid().allow(null),
};

export const schemaCreate = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
