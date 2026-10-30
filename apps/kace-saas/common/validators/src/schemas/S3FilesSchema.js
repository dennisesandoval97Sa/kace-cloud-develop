import Joi from "joi";

const commonFileFields = {
    description: Joi.string().max(255),
    file_name: Joi.string().max(100),
    s3_file_name: Joi.string().max(100),
    url: Joi.string().uri(),
    size: Joi.number().positive(),
    origin: Joi.string().max(100).allow(null),
    expired_at: Joi.date().allow(null),
    is_active: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.boolean(),
    ),
};

export const S3FileCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...commonFileFields,
    description: commonFileFields.description.required(),
    file_name: commonFileFields.file_name.required(),
    s3_file_name: commonFileFields.s3_file_name.required(),
    url: commonFileFields.url.required(),
    size: commonFileFields.size.required(),
    created_at: Joi.date().iso().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const S3FileUpdateSchema = Joi.object({
    ...commonFileFields,
    updated_at: Joi.date().iso().optional(),
    updated_by: Joi.string().uuid().optional(),
});
