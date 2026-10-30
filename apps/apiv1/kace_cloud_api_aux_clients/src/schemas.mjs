import { ValueObjectUuid } from '@kace/core/src/shared/index.js';
import Joi from 'joi';

export const createSchema = Joi.object({
    id: Joi.string()
        .uuid()
        .default(() => ValueObjectUuid.random()),
    cliente_id: Joi.string().uuid().required(),
    data: Joi.object().required(),
    created_at: Joi.date().iso().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const updateSchema = Joi.object({
    data: Joi.object(),
    updated_at: Joi.date().iso().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
