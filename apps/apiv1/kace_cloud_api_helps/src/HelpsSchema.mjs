import Joi from 'joi';
import { SHARED_VISUAL_COLOR_ALLOWLIST } from '@kace/core/src/shared/visual-options/sharedVisualOptions.js';

const allowlistedHelpColor = Joi.string()
    .valid(...SHARED_VISUAL_COLOR_ALLOWLIST)
    .messages({ 'any.only': '"color" must be an approved visual color' });

const base = {
    titulo: Joi.string().max(50).min(5).required(),
    descripcion: Joi.string().max(30000).min(10).required(),
    color: allowlistedHelpColor.required(),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
};

export const HelpsSchemaForm = Joi.object({ ...base });

export const HelpsCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    created_at: Joi.date().timestamp(),
    created_by: Joi.string().uuid(),
});

export const HelpsUpdateSchema = Joi.object({
    titulo: Joi.string().max(50).min(5),
    descripcion: Joi.string().max(30000).min(10),
    color: allowlistedHelpColor,
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().required(),
});
