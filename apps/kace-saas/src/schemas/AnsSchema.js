import Joi from "joi";
import { AnsTypes } from "../enums/AnsTypes.js";
import { JoiHelper } from "@/utils/src/utils/joi.helper";
import { SHARED_VISUAL_COLOR_ALLOWLIST } from "@kace/core/src/shared/visual-options/sharedVisualOptions.js";

const AnsSchemaBase = {
    nombre: JoiHelper.onlyLetters({ max: 100 }).required(),
    intermedio: JoiHelper.integer({ min: 0 }).required(),
    vencido: JoiHelper.integer({ min: 0 })
        .greater(Joi.ref("intermedio"))
        .messages({
            "number.greater": "number.minGreater",
        })
        .required(),
    color_ans_inicial: JoiHelper.color()
        .valid(...SHARED_VISUAL_COLOR_ALLOWLIST)
        .required(),
    color_ans_intermedio: JoiHelper.color()
        .valid(...SHARED_VISUAL_COLOR_ALLOWLIST)
        .required(),
    color_ans_final: JoiHelper.color()
        .valid(...SHARED_VISUAL_COLOR_ALLOWLIST)
        .required(),
    medicion_ans_id: JoiHelper.generalText({ max: 100 }).required(),
    status: JoiHelper.integer(),
};

export const AnsCreateSchemaForm = Joi.object(AnsSchemaBase).strict();

export const AnsCreateSchema = Joi.object({
    ...AnsSchemaBase,
    id: JoiHelper.uuid().required(),
    created_at: JoiHelper.date().timestamp(),
    created_by: JoiHelper.uuid(),
}).strict();

export const AnsUpdateSchema = Joi.object({
    nombre: JoiHelper.onlyLetters({ max: 100 }),
    intermedio: JoiHelper.integer({ min: 1 }),
    vencido: JoiHelper.integer({ min: 1 }),
    color_ans_inicial: JoiHelper.color().valid(...SHARED_VISUAL_COLOR_ALLOWLIST),
    color_ans_intermedio: JoiHelper.color().valid(...SHARED_VISUAL_COLOR_ALLOWLIST),
    color_ans_final: JoiHelper.color().valid(...SHARED_VISUAL_COLOR_ALLOWLIST),
    medicion_ans_id: JoiHelper.generalText({ max: 100 }),
    status: JoiHelper.integer(),
    updated_at: JoiHelper.date().required(),
    updated_by: JoiHelper.uuid().required(),
}).strict();

export const AnsCalculateSchema = Joi.object({
    measurementType: Joi.string()
        .valid(...Object.values(AnsTypes.toJson()))
        .required(),
}).strict();
