import Joi from "joi";

const literalBaseSchema = {
    tipo_literal: Joi.string().uuid().allow(null),
    nombre: Joi.string().max(255),
    is_active: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.boolean(),
    ),
};

export const literalSchemaForm = Joi.object({
    ...literalBaseSchema,
    nombre: literalBaseSchema.nombre.required(),
});

export const LiteralCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...literalBaseSchema,
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const LiteralUpdateSchema = Joi.object({
    ...literalBaseSchema,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
