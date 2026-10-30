import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

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
    description: JoiHelper.legacyText({ max: 255 }),
    settings: settingsSchema,
    is_active: JoiHelper.boolean(),
    created_at: JoiHelper.date(),
    updated_at: JoiHelper.date(),
    created_by: JoiHelper.uuid(),
    updated_by: JoiHelper.uuid(),
};

export const GlobalConfigCreateSchema = Joi.object({
    id: JoiHelper.uuid(),
    ...baseSchema,
}).strict();

export const GlobalConfigUpdateSchema = Joi.object({
    ...baseSchema,
}).strict();
