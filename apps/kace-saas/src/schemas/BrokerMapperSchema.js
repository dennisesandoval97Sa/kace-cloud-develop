import Joi from "joi";

export const BrokerMapperRuleSchema = Joi.object({
    id: Joi.string().uuid().empty("").optional(),
    mapper_id: Joi.string().uuid().empty("").optional(),
    target_entity: Joi.string().max(255).empty("").required(),
    target_field: Joi.string().max(255).empty("").required(),
    source_field: Joi.string().max(1024).empty("").required(),
    parse_to: Joi.string().valid("string", "number", "boolean", "datetime").allow(null, "").optional(),
});

export const BrokerMapperCreateSchema = Joi.object({
    id: Joi.string().uuid().empty("").optional(),
    name: Joi.string().max(255).empty("").required(),
    rest_flow_id: Joi.string().max(255).empty("").required(),
    queue: Joi.string().max(255).empty("").allow(null).optional(),
    rules: Joi.array().items(BrokerMapperRuleSchema).default([]),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const BrokerMapperUpdateSchema = Joi.object({
    name: Joi.string().max(255).empty("").optional(),
    rest_flow_id: Joi.string().max(255).empty("").optional(),
    queue: Joi.string().max(255).empty("").allow(null).optional(),
    rules: Joi.array().items(BrokerMapperRuleSchema).optional(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
