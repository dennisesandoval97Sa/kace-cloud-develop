import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const commonFields = {
    nivel1: JoiHelper.legacyText({ max: 100 }),
    nivel2: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel3: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel4: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel5: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel6: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel7: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel8: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel9: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel10: JoiHelper.legacyText({ max: 100 }).allow(""),
    flujo_id: JoiHelper.uuid(),
    ans_id: JoiHelper.uuid(),
    external_id: JoiHelper.legacyText({ max: 45 }).allow(""),
    default_group_id: JoiHelper.uuid().allow(""),
    folio_config_id: JoiHelper.uuid().allow("", null),
    is_active: JoiHelper.boolean(),
    can_start_sub_cases_flow: JoiHelper.boolean(),
};

export const ClassificationSchemaForm = Joi.object({
    ...commonFields,
    nivel1: commonFields.nivel1.required(),
    flujo_id: commonFields.flujo_id.required(),
    ans_id: commonFields.ans_id.required(),
}).strict();

export const ClassificationCreateSchema = Joi.object({
    id: JoiHelper.uuid().required(),
    ...commonFields,
    nivel1: commonFields.nivel1.required(),
    flujo_id: commonFields.flujo_id.required(),
    ans_id: commonFields.ans_id.required(),
}).strict();

export const ClassificationUpdateSchema = Joi.object({ ...commonFields }).strict();
