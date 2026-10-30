import Joi from "joi";

const base = {
    template_id: Joi.string().uuid(),
    type: Joi.string().max(100),
    path: Joi.string().max(1000),
    is_active: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.boolean(),
    ),
};

export const createTemplateAttachmentSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    template_id: base.template_id.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const updateTemplateAttachmentSchema = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
