import Joi from "joi";

const stateSchemaCreate = Joi.object({
    id: Joi.string()
        .guid({ version: ["uuidv4"] })
        .required(),
    estado_actual_id: Joi.string()
        .guid({ version: ["uuidv4"] })
        .required()
        .allow(null),
    siguiente_estado_id: Joi.string()
        .guid({ version: ["uuidv4"] })
        .required(),
});

export const TransitionCreateSchema = Joi.object({
    states: Joi.array().items(stateSchemaCreate).required(),
    flujo_id: Joi.string().max(100).required(),
    status: Joi.number().integer().required(),
    created_at: Joi.date().required(),
    created_by: Joi.string().uuid().required(),
});

export const TransitionUpdateSchema = Joi.object({
    estado_actual_id: Joi.string().max(100).min(1),
    siguiente_estado_id: Joi.string().max(100).min(1),
    flujo_id: Joi.string().max(100).min(1),
    status: Joi.number().integer(),
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().required(),
});
