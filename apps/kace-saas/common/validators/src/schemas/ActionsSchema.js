import Joi from "joi";

const baseSchema = {
    action_type: Joi.string().max(100),
    description: Joi.string().max(255),
    conditions: Joi.object(),
    triggers: Joi.array().allow(null),
    permissions: Joi.object().allow(null),
    state_id: Joi.string().uuid().allow(null),
    group_id: Joi.string().uuid().allow(null),
    responsible_id: Joi.string().uuid().allow(null),
    template_id: Joi.string().uuid().allow(null),
    mail_account_id: Joi.string().uuid().allow(null),
    advisor_list_id: Joi.string().uuid().allow(null),
    group_list_id: Joi.string().uuid().allow(null),
    ws_rest_flow_id: Joi.string().uuid().allow(null),
    model_update_id: Joi.string().uuid().allow(null),
    external_group_code: Joi.string().max(200).allow(null),
    external_user_code: Joi.string().max(200).allow(null),
    priority: Joi.number().min(1).max(100),
    is_active: Joi.boolean().allow(null),
};

export const ActionCreateSchema = Joi.object({
    ...baseSchema,
    id: Joi.string().uuid().required(),
    action_type: baseSchema.action_type.required(),
    description: baseSchema.description.required(),
    conditions: baseSchema.conditions.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const ActionUpdateSchema = Joi.object({
    ...baseSchema,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
