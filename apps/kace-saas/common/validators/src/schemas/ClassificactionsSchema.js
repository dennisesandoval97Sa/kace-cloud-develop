import Joi from "joi";

const commonFields = {
    nivel1: Joi.string().max(100),
    nivel2: Joi.string().max(100).allow(""),
    nivel3: Joi.string().max(100).allow(""),
    nivel4: Joi.string().max(100).allow(""),
    nivel5: Joi.string().max(100).allow(""),
    nivel6: Joi.string().max(100).allow(""),
    nivel7: Joi.string().max(100).allow(""),
    nivel8: Joi.string().max(100).allow(""),
    nivel9: Joi.string().max(100).allow(""),
    nivel10: Joi.string().max(100).allow(""),
    flujo_id: Joi.string().uuid(),
    ans_id: Joi.string().uuid(),
    external_id: Joi.string().max(45).allow(""),
    default_group_id: Joi.string().uuid().allow(""),
    is_active: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.boolean(),
    ),
};

export const ClassificationSchemaForm = Joi.object({
    ...commonFields,
    nivel1: commonFields.nivel1.required(),
    flujo_id: commonFields.flujo_id.required(),
    ans_id: commonFields.ans_id.required(),
});

export const ClassificationCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...commonFields,
    nivel1: commonFields.nivel1.required(),
    flujo_id: commonFields.flujo_id.required(),
    ans_id: commonFields.ans_id.required(),
    created_at: Joi.date().timestamp().required(),
    created_by: Joi.string().uuid().required(),
});

export const ClassificationUpdateSchema = Joi.object({
    ...commonFields,
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional(),
});
