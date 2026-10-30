import Joi from "joi";
import { HttpRequestTypes } from "../enums/HttpRequestTypes.js";
import { HttpMethods } from "../enums/HttpMethods.js";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    description: JoiHelper.legacyText({ max: 255 }).required(),
    type: Joi.string()
        .valid(...Object.values(HttpRequestTypes.toJson()))
        .required(),
    url: JoiHelper.uri({ max: 1000 }).required(),
    method: Joi.string()
        .valid(...Object.values(HttpMethods.toJson()))
        .required(),
    headers: Joi.string().optional(),
    body: Joi.string().optional(),
    body_type: Joi.string().valid("json", "plain_text").optional(),
    is_dynamic_body: JoiHelper.boolean(),
    is_dynamic_header: JoiHelper.boolean(),
    filter_input: Joi.string().optional(),
    authorization_id: JoiHelper.uuid().allow(null, "").optional(),
    context_position: JoiHelper.legacyText().required(),
    on_success: Joi.string().optional(),
    on_error: Joi.string().optional(),
    attempts: JoiHelper.integer({ min: 0, max: 1 }).required(),
    is_active: JoiHelper.boolean(),
    cache_expires_in_path: Joi.string().max(255).allow(null, "").optional(),
    cache_default_ttl_seconds: Joi.number().integer().min(1).allow(null).optional(),
};

export const WSRestEndpointCreateSchema = Joi.object({
    ...base,
    id: JoiHelper.uuid().optional(),
}).strict();

export const WSRestEndpointUpdateSchema = Joi.object({
    ...base,
}).strict();
