import Joi from 'joi';

export const ChannelHubCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    country_id: Joi.string().max(10).required(),
    operator_id: Joi.string().valid('imap', 'gmail', 'microsoft').default('imap'),
    rest_flow_id: Joi.string().uuid().required(),
    mail_rule_list_rest_flow_id: Joi.string().uuid().optional(),
    mail_rule_priority_update_rest_flow_id: Joi.string().uuid().optional(),
    is_active: Joi.boolean().default(true),
    created_at: Joi.date().required(),
    created_by: Joi.string().uuid().required(),
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().required(),
});

export const ChannelHubUpdateSchema = Joi.object({
    email: Joi.string().email().optional().strip(),
    name: Joi.string().optional(),
    country_id: Joi.string().max(10).optional(),
    operator_id: Joi.string().valid('imap', 'gmail', 'microsoft').optional(),
    rest_flow_id: Joi.string().uuid().optional(),
    mail_rule_list_rest_flow_id: Joi.string().uuid().optional(),
    mail_rule_priority_update_rest_flow_id: Joi.string().uuid().optional(),
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().required(),
});

export const WorkspacePriorityUpdateSchema = Joi.object({
    revision: Joi.string().trim().min(1).required(),
    orderedWorkspaceIds: Joi.array().items(Joi.string().uuid().required()).min(1).unique().required(),
}).required();
