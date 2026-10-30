import Joi from 'joi';
import { SHARED_VISUAL_COLOR_ALLOWLIST } from '@kace/core/src/shared/visual-options/sharedVisualOptions.js';

const allowlistedAnsColor = (fieldName) =>
    Joi.string()
        .valid(...SHARED_VISUAL_COLOR_ALLOWLIST)
        .messages({ 'any.only': `"${fieldName}" must be an approved visual color` });

const schemaBase = Joi.object({
    nombre: Joi.string()
        .pattern(/^[a-zA-ZÀ-ÿ\s]+$/)
        .max(100)
        .required()
        .messages({
            'string.pattern.base': `"nombre" can only contain letters.`,
        }),
    intermedio: Joi.number().integer().required(),
    vencido: Joi.number().integer().required(),
    color_ans_inicial: allowlistedAnsColor('color_ans_inicial').required(),
    color_ans_intermedio: allowlistedAnsColor('color_ans_intermedio').required(),
    color_ans_final: allowlistedAnsColor('color_ans_final').required(),
    medicion_ans_id: Joi.string().max(100).required(),
    status: Joi.number().integer(),
});

export const createSchemaForm = schemaBase;

export const createSchema = schemaBase.keys({
    id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp(),
    created_by: Joi.string().uuid(),
});

export const updateSchema = Joi.object({
    nombre: Joi.string().max(100).min(1),
    intermedio: Joi.number().integer().min(1),
    vencido: Joi.number().integer().min(1),
    color_ans_inicial: allowlistedAnsColor('color_ans_inicial'),
    color_ans_intermedio: allowlistedAnsColor('color_ans_intermedio'),
    color_ans_final: allowlistedAnsColor('color_ans_final'),
    medicion_ans_id: Joi.string().max(100).min(1),
    status: Joi.number().integer(),
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().required(),
});
