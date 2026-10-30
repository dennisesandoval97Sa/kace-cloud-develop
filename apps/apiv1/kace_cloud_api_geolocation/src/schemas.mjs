import Joi from 'joi';

const schemaBase = Joi.object({
    action_type: Joi.string().max(255).required(),
    longitud: Joi.string().max(100).required(),
    latitud: Joi.string().max(100).required(),
    ip4_address: Joi.string().max(15).required(),
    metadata: Joi.object(),
});

export const createSchemaForm = schemaBase;

export const createSchema = schemaBase.keys({
    id: Joi.string().uuid().required(),
    user_id: Joi.string().max(36).required(),
    created_at: Joi.date().timestamp(),
    created_by: Joi.string().uuid(),
});

export const updateSchema = schemaBase.keys({
    updated_at: Joi.date().timestamp(),
    updated_by: Joi.string().uuid(),
});
