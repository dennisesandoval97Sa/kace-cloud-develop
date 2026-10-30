import Joi from 'joi';
import { RegexPatterns } from '@kace/core/src/shared/index.js';

const externalDynamicCodeSchema = Joi.string()
    .trim()
    .max(100)
    .pattern(RegexPatterns.extendedCharactersRegex())
    .allow(null);

const schemaBase = {
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
    external_group_code: Joi.string().max(500).allow(null),
    external_user_code: Joi.string().max(500).allow(null),
    external_group_dynamic_code: externalDynamicCodeSchema,
    external_user_dynamic_code: externalDynamicCodeSchema,
    priority: Joi.number().min(1).max(100),
    is_active: Joi.boolean().allow(null),
    automation_id: Joi.string().uuid().allow(null),
    entity: Joi.string().max(255),
};

export const schemaCreate = Joi.object({
    ...schemaBase,
    id: Joi.string().uuid().required(),
    action_type: schemaBase.action_type.required(),
    description: schemaBase.description.required(),
    conditions: schemaBase.conditions.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
