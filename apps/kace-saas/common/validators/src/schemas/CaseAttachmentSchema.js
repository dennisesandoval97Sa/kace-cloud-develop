import Joi from "joi";

const base = {
    case_id: Joi.string().uuid(),
    description: Joi.string().max(255),
    size: Joi.number().integer(),
    path: Joi.string().max(1000),
    type: Joi.number().integer().min(0).max(32767),
    is_active: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.boolean(),
    ),
};

export const createCaseAttachmentSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    case_id: base.case_id.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const updateCaseAttachmentSchema = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
