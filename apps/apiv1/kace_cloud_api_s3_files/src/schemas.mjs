import Joi from 'joi';

const schemaBase = {
    description: Joi.string().max(255),
    file_name: Joi.string().max(100),
    s3_file_name: Joi.string().max(100),
    url: Joi.string().uri(),
    size: Joi.number().positive(),
    origin: Joi.string().max(100).allow(null),
    expired_at: Joi.date().allow(null),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
};

export const schemaCreate = Joi.object({
    ...schemaBase,
    id: Joi.string().uuid().required(),
    description: schemaBase.description.required(),
    file_name: schemaBase.file_name.required(),
    s3_file_name: schemaBase.s3_file_name.required(),
    url: schemaBase.url.required(),
    size: schemaBase.size.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
