import Joi from "joi";

export const dataModule = Joi.any().required();
const moduleSchema = Joi.object().optional();

const sectionSchema = Joi.object({
    application: Joi.object({
        admin: moduleSchema,
        agente: moduleSchema,
    }).required(),
}).required();

const settingsSchema = Joi.object({
    layouts: sectionSchema,
    behaviors: sectionSchema,
    custom_fields: sectionSchema,
}).required();

const baseSchema = {
    description: Joi.string().max(255),
    settings: settingsSchema,
    is_active: Joi.boolean(),
    created_at: Joi.date(),
    updated_at: Joi.date(),
    created_by: Joi.string().uuid(),
    updated_by: Joi.string().uuid(),
};
export const GlobalConfigCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    ...baseSchema,
});
export const GlobalConfigUpdateSchema = Joi.object({
    ...baseSchema,
    is_active: Joi.boolean(),
});
