import Joi from "joi";
import { RegexPatterns } from "../utils/regex/RegexPatterns";

const commonFields = {
    nivel1: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100),
    nivel2: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100)
        .allow(""),
    nivel3: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100)
        .allow(""),
    nivel4: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100)
        .allow(""),
    nivel5: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100)
        .allow(""),
    nivel6: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100)
        .allow(""),
    nivel7: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100)
        .allow(""),
    nivel8: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100)
        .allow(""),
    nivel9: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100)
        .allow(""),
    nivel10: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .max(100)
        .allow(""),
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
