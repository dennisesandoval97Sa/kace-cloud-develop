import Joi from "joi";

const base = {
    titulo: Joi.string().max(50).min(5).required(),
    descripcion: Joi.string().max(30000).min(10).required(),
    color: Joi.string().max(100).required(),
    is_active: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.boolean(),
    ),
};

export const HelpsSchemaForm = Joi.object({ ...base });

export const HelpsCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    created_at: Joi.date().timestamp(),
    created_by: Joi.string().uuid(),
});

export const HelpsUpdateSchema = Joi.object({
    titulo: Joi.string().max(50).min(5),
    descripcion: Joi.string().max(30000).min(10),
    color: Joi.string().max(100),
    is_active: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.boolean(),
    ),
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().required(),
});
