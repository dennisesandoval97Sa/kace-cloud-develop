import Joi from 'joi';

const RESERVED_NAMES = ['cases', 'clients', 'definitions'];

const nameValidator = Joi.string()
    .pattern(/^[a-z][a-z0-9_]*$/, 'lower_snake_case')
    .min(3)
    .max(50)
    .invalid(...RESERVED_NAMES)
    .required();

const base = {
    name: nameValidator,
    tablename: Joi.string().max(63).min(1),
    logs_tablename: Joi.string().max(63).min(1),
    schema_id: Joi.string().uuid(),
    restflow_id: Joi.string().uuid(),
    is_active: Joi.boolean(),
};

export const schemaCreate = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const schemaUpdate = Joi.object({
    schema_id: Joi.string().uuid().optional(),
    restflow_id: Joi.string().uuid().optional(),
    is_active: Joi.boolean().optional(),
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional(),
}).min(1);

export const schemaDelete = Joi.object({
    ...base,
    deleted_at: Joi.date().timestamp().optional(),
    deleted_by: Joi.string().uuid().optional(),
});
