import Joi from 'joi';

const groupSchema = Joi.object({
    id: Joi.string().uuid().required(),
}).unknown();

const schemaBase = {
    descripcion: Joi.string().min(3).max(255).required(),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
};

export const createSchema = Joi.object({
    id: Joi.string().uuid().required(),
    lista_grupos: Joi.array().items(groupSchema),
    ...schemaBase,
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const updateSchema = Joi.object({
    ...schemaBase,
    lista_grupos: Joi.array().items(groupSchema),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
