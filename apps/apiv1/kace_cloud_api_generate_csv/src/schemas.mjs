import Joi from 'joi';

const pathPattern = /^([\w-]+)+(\/[\w-.]+)*$/;

const baseSchema = {
    description: Joi.string().max(255),
    is_active: Joi.boolean().default(true),
    details: Joi.object().optional(),
    
    views: Joi.array().required(),
    time_filter: Joi.object().required(),

    frequency: Joi.string().valid('hours', 'days', 'weeks', 'months').optional(),
    interval: Joi.number().integer().min(1).max(365).optional(),
    storage_path: Joi.string().pattern(pathPattern).max(1024),

    last_execution_at: Joi.date().allow(null),
    last_execution_details: Joi.object(),
    next_execution_at: Joi.date(),
};

export const schemaCreate = Joi.object({
    ...baseSchema,
    id: Joi.string().uuid().required(),
    description: baseSchema.description.required(),
    is_active: baseSchema.is_active.required(),
    views: baseSchema.views.required(),
    frequency: baseSchema.frequency.required(),
    interval: baseSchema.interval.required(),
    time_filter: baseSchema.time_filter.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...baseSchema,
    id: Joi.forbidden(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
