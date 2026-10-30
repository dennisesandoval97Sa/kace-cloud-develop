import Joi from 'joi';

const schemaBase = {
    tipo_literal: Joi.string().uuid().allow(null),
    nombre: Joi.string().max(255),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
};

export const shemaForm = Joi.object({
    ...schemaBase,
    nombre: schemaBase.nombre.required(),
});

export const schemaCreate = Joi.object({
    id: Joi.string().uuid().required(),
    ...schemaBase,
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
