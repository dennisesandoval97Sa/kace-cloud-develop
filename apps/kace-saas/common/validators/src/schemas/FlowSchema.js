import Joi from "joi";

export const FlowCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    nombre: Joi.string().max(100).required(),
    json_flujo: Joi.object().required(),
    status: Joi.number().integer().allow(null),
    created_at: Joi.date().iso().allow(null),
    created_by: Joi.string().uuid().allow(null),
});
export const FlowCreateSchemaForm = Joi.object({
    id: Joi.string().uuid(),
    nombre: Joi.string().max(100).required(),
    json_flujo: Joi.required(),
    status: Joi.number().integer(),
});

export const FlowUpdateSchema = Joi.object({
    nombre: Joi.string().max(100).min(1),
    json_flujo: Joi.object(),
    status: Joi.number().integer().allow(null),
    updated_at: Joi.date().iso().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
