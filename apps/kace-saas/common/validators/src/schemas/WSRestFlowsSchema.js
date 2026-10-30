import Joi from "joi";

const base = {
    description: Joi.string().max(255).required(),
    authorization_id: Joi.string().uuid().allow(null),
    consumption_id: Joi.string().uuid(),
    authorization_type: Joi.string().max(50).allow(null),
    timeout: Joi.number().integer().min(0),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
};

export const WSRestFlowCreateSchema = Joi.object({
    ...base,
    id: Joi.string().uuid().required(),
    description: base.description.required(),
    consumption_id: base.consumption_id.required(),
    timeout: base.timeout.required(),
    is_active: base.is_active.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const WSRestFlowUpdateSchema = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
