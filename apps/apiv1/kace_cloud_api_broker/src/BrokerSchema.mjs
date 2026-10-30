import Joi from 'joi';
import { HttpRequestTypes } from '@kace/core/src/ws-rest-endpoints/domain/HttpRequestTypes';
import { HttpMethods } from '@kace/core/src/ws-rest-endpoints/domain/HttpMethods';

const base = {
    type: Joi.string().valid(...Object.values(HttpRequestTypes.toJson())),
    description: Joi.string().max(255),
    url: Joi.string().max(1000),
    method: Joi.string().valid(...Object.values(HttpMethods.toJson())),
    headers: Joi.object().optional(),
    body: Joi.object().optional(),
    is_dynamic_body: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    authorization_id: Joi.string().uuid().optional().allow(null),
    is_dynamic_header: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    filter_input: Joi.object().unknown(true),
    context_position: Joi.string().max(255),
    initial_context: Joi.object().unknown(true).optional(),
    on_success: Joi.object().unknown(true),
    on_error: Joi.object().unknown(true),
    attempts: Joi.number(),
};

export const WSRestEndpointCreateSchema = Joi.object({
    ...base,
    id: Joi.string().uuid().required(),
    type: base.type.required(),
    description: base.description.required(),
    url: base.url.required(),
    method: base.method.required(),
    is_dynamic_body: base.is_dynamic_body.required(),
    is_active: base.is_active.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
    filter_input: base.filter_input.required(),
    context_position: Joi.string().max(255),
    on_success: Joi.object().required(),
    on_error: Joi.object().required(),
    attempts: Joi.number().required(),
});

export const WSRestEndpointUpdateSchema = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});

export const BrokerAdapterCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    name: Joi.string().max(255).required(),
    host: Joi.string().max(512).required(),
    port: Joi.number().integer().min(1).max(65535).optional(),
    queue: Joi.string().max(255).required(),
    vhost: Joi.string().max(255).required(),
    exchange: Joi.string().max(255).allow(null).optional(),
    username: Joi.string().max(255).allow(null).optional(),
    password: Joi.string().max(255).allow(null).optional(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const BrokerAdapterUpdateSchema = Joi.object({
    name: Joi.string().max(255).optional(),
    host: Joi.string().max(512).optional(),
    port: Joi.number().integer().min(1).max(65535).optional(),
    queue: Joi.string().max(255).optional(),
    vhost: Joi.string().max(255).optional(),
    exchange: Joi.string().max(255).allow('', null).optional(),
    username: Joi.string().max(255).allow('', null).optional(),
    password: Joi.string().max(255).allow('', null).optional(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});

export const BrokerMapperRuleSchema = Joi.object({
    id: Joi.string().uuid().optional(),
    mapper_id: Joi.string().uuid().optional(),
    target_entity: Joi.string().max(255).required(),
    target_field: Joi.string().max(255).required(),
    source_field: Joi.string().max(1024).required(),
});

export const BrokerMapperCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    name: Joi.string().max(255).required(),
    adapter_id: Joi.string().uuid().allow(null).optional(),
    rest_flow_id: Joi.string().max(255).allow(null).optional(),
    rules: Joi.array().items(BrokerMapperRuleSchema).optional(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const BrokerMapperUpdateSchema = Joi.object({
    name: Joi.string().max(255).optional(),
    adapter_id: Joi.string().uuid().allow(null).optional(),
    rest_flow_id: Joi.string().max(255).allow(null).optional(),
    rules: Joi.array().items(BrokerMapperRuleSchema).optional(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
