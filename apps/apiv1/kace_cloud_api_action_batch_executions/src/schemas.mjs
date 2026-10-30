import Joi from 'joi';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { ValueObjectUuid } from '@kace/core/src/shared/index.js';

export const validateFileSchema = Joi.object({
    fileName: Joi.string()
        .max(255)
        .regex(/\.csv$/i)
        .required()
        .messages({
            'string.pattern.base': 'The file must have a .csv extension',
        }),
    url: Joi.string().max(255).required(),
    id: Joi.string().uuid().required(),
    separator: Joi.string().max(1),
});

const schemaBase = Joi.object({
    id: Joi.string().uuid().required(),
    type: Joi.string().valid('filter', 'file', 'file_clients', 'filter_clients').required(),
    action_id: Joi.string().uuid(),
    search_filter: Joi.alternatives().conditional('type', {
        is: Joi.valid('filter', 'filter_clients'),
        then: SearchSchema.required(),
        otherwise: Joi.optional(),
    }),
    s3_file_key: Joi.alternatives().conditional('type', {
        is: Joi.valid('file', 'file_clients'),
        then: Joi.string()
            .max(1024)
            .regex(/\.csv$/i)
            .required()
            .messages({
                'string.pattern.base': 'The file must have a .csv extension',
            }),
        otherwise: Joi.optional(),
    }),
    details: Joi.object().optional(),
    separator: Joi.string().max(1),
    restflow_id: Joi.string().uuid(),
    restflow_context: Joi.object().optional(),
    evaluate_conditions: Joi.boolean().optional(),
});

export const schemaCreate = schemaBase.keys({
    id: Joi.string().default(() => ValueObjectUuid.random()),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = schemaBase.keys({
    id: Joi.forbidden(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
