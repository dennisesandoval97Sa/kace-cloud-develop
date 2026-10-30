import Joi from 'joi';

const schemaBase = Joi.object({
    description: Joi.string().max(255).required(),
    is_active: Joi.boolean().required(),
    one_script_id: Joi.string().uuid().optional().empty(''),
    daily_limit: Joi.number().integer().required(),
    is_for_weekend: Joi.boolean().required(),
});

export const createSchemaForm = schemaBase;

export const createSchema = schemaBase.keys({
    id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp(),
    created_by: Joi.string().uuid(),
});

export const updateSchema = schemaBase.keys({
    updated_at: Joi.date().timestamp(),
    updated_by: Joi.string().uuid(),
});
