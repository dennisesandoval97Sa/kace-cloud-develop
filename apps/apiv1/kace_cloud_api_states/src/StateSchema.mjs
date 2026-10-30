import Joi from 'joi';
import {
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from '@kace/core/src/shared/visual-options/sharedVisualOptions.js';

const allowlistedIconClass = Joi.string()
    .valid(...SHARED_VISUAL_ICON_ALLOWLIST)
    .messages({ 'any.only': '"icon_class" must be an approved visual icon' });

const allowlistedColor = Joi.string()
    .valid(...SHARED_VISUAL_COLOR_ALLOWLIST)
    .messages({ 'any.only': '"color" must be an approved visual color' });

const base = {
    nombre: Joi.string().max(100),
    descripcion: Joi.string().max(1000),
    icon_class: allowlistedIconClass,
    status: Joi.number().integer(),
    color: allowlistedColor,
    require_observation: Joi.boolean(),
};

const requiredFields = {
    nombre: base.nombre.required(),
    descripcion: base.descripcion.required(),
    color: base.color.required(),
    status: base.status.required(),
};

export const StatesCreateSchema = Joi.object({
    ...base,
    ...requiredFields,
    id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const StatesUpdateSchema = Joi.object({
    ...base,
    updated_at: Joi.date().timestamp().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
