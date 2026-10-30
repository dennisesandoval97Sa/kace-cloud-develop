import { ValueObjectUuid } from '@kace/core/src/shared/index.js';
import Joi from 'joi';

export const DISALLOWED_AUXILIARY_DELETE = ['cases', 'clients'];

const base = {
    id: Joi.string().uuid(),
    data: Joi.object().required(),
};

export const schemaCreate = Joi.object({
    ...base,
    id: Joi.string()
        .uuid()
        .default(() => ValueObjectUuid.random()),
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const schemaUpdate = Joi.object({
    ...base,
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional(),
});

export const schemaDelete = Joi.object({
    ...base,
    deleted_at: Joi.date().timestamp().optional(),
    deleted_by: Joi.string().uuid().optional(),
});
