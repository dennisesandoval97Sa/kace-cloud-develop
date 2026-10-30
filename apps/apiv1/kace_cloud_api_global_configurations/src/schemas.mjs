import Joi from 'joi';

const moduleSchema = Joi.object().optional();

const sectionSchema = Joi.object({
    application: Joi.object({
        admin: moduleSchema,
        agente: moduleSchema,
    }).optional(),
}).optional();

const settingsSchema = Joi.object({
    layouts: sectionSchema,
    behaviors: sectionSchema,
    custom_fields: sectionSchema,
}).optional();

const schemaBase = {
    description: Joi.string().max(255),
    settings: settingsSchema,
    is_active: Joi.boolean(),
    created_at: Joi.date(),
    updated_at: Joi.date(),
    created_by: Joi.string().uuid(),
    updated_by: Joi.string().uuid(),
};

export const createSchema = Joi.object({
    id: Joi.string().uuid(),
    ...schemaBase,
    settings: settingsSchema.required(),
});

export const updateSchema = Joi.object({
    ...schemaBase,
    is_active: Joi.boolean(),
});
