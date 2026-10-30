import Joi from 'joi';

const schemaBase = {
    descripcion: Joi.string().required(),
};

export const createSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...schemaBase,
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const updateSchema = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
