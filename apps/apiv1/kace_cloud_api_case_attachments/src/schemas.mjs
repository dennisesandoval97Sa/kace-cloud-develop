import Joi from 'joi';

const schemaBase = {
    case_id: Joi.string().uuid(),
    description: Joi.string().max(255),
    size: Joi.number().integer(),
    path: Joi.string().max(1000),
    type: Joi.number().integer().min(0).max(32767),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    attachment_type: Joi.string().max(255).allow(null, '').optional(),
};

export const createSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...schemaBase,
    case_id: schemaBase.case_id.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const updateSchema = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
