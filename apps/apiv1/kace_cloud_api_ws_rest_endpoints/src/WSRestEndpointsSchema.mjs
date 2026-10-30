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
    body_type: Joi.string().valid('json', 'plain_text').optional().allow(null),
    is_dynamic_body: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    authorization_id: Joi.string().uuid().optional().allow(null),
    is_dynamic_header: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    filter_input: Joi.object().unknown(true),
    context_position: Joi.string().max(255),
    initial_context: Joi.object().unknown(true).optional().allow(null),
    on_success: Joi.object().unknown(true),
    on_error: Joi.object().unknown(true),
    attempts: Joi.number(),
    cache_expires_in_path: Joi.string().max(255).optional().allow(null),
    cache_default_ttl_seconds: Joi.number().integer().optional().allow(null),
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
