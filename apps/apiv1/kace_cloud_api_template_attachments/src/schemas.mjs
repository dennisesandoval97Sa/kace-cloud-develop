import Joi from 'joi';

const schemaBase = {
    template_id: Joi.string().uuid(),
    type: Joi.string().max(100),
    path: Joi.string().max(1000),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    usage_type: Joi.string().max(20).allow(null, '').optional(),
};

export const schemaCreate = Joi.object({
    ...schemaBase,
    id: Joi.string().uuid().required(),
    template_id: schemaBase.template_id.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
