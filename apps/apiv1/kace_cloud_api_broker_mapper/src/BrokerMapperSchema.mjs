import Joi from 'joi';

export const BrokerMapperRuleSchema = Joi.object({
    id: Joi.string().uuid().optional(),
    mapper_id: Joi.string().uuid().optional(),
    target_entity: Joi.string().max(255).required(),
    target_field: Joi.string().max(255).required(),
    source_field: Joi.string().max(1024).required(),
    parse_to: Joi.string().valid('string', 'number', 'boolean', 'datetime').allow(null).optional(),
});

export const BrokerMapperCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    name: Joi.string().max(255).required(),
    adapter_id: Joi.string().uuid().allow(null).optional(),
    rest_flow_id: Joi.string().max(255).required(),
    queue: Joi.string().max(255).allow(null).optional(),
    rules: Joi.array().items(BrokerMapperRuleSchema).default([]),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const BrokerMapperUpdateSchema = Joi.object({
    name: Joi.string().max(255).optional(),
    adapter_id: Joi.string().uuid().allow(null).optional(),
    rest_flow_id: Joi.string().max(255).optional(),
    queue: Joi.string().max(255).allow(null).optional(),
    rules: Joi.array().items(BrokerMapperRuleSchema).optional(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
