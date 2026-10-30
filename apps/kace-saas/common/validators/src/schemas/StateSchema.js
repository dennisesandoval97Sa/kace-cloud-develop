import Joi from "joi";

export const StateSchemaBase = Joi.object({
    nombre: Joi.string().required().max(100),
    descripcion: Joi.string().required().max(1000),
    icon_class: Joi.string().max(20),
    status: Joi.number().integer(),
    color: Joi.string().required().max(15),
    require_observation: Joi.boolean(),
});

export const createStateSchema = StateSchemaBase.keys({
    id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp(),
    created_by: Joi.string().uuid(),
});

export const updateStateSchema = StateSchemaBase.keys({
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});

export const StatesSchemaForm = Joi.object({
    nombre: Joi.string().required().max(100),
    descripcion: Joi.string().required().max(1000),
    icon_class: Joi.string().max(20),
    status: Joi.number().integer(),
    color: Joi.string().required().max(15),
    require_observation: Joi.boolean(),
});
