import Joi from 'joi';

const baseSchema = {
    name: Joi.string().max(255),
    url: Joi.string().max(300),
    url_api: Joi.string().max(300),
    schema_id: Joi.string().uuid().allow(null),
    onescript_reference_id: Joi.string().uuid(),
};

export const OneScriptSchemaForm = Joi.object(baseSchema);

export const OneScriptCreateSchema = Joi.object({
    ...baseSchema,
    onescript_reference_id: baseSchema.onescript_reference_id.required(),
    id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const OneScriptUpdateSchema = Joi.object({
    ...baseSchema,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
