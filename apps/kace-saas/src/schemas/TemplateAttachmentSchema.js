import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    template_id: JoiHelper.uuid(),
    type: JoiHelper.generalText({ max: 100 }),
    path: JoiHelper.legacyText({ max: 1000 }),
    is_active: JoiHelper.boolean(),
};

export const createTemplateAttachmentSchema = Joi.object({
    id: JoiHelper.uuid().required(),
    ...base,
    template_id: base.template_id.required(),
}).strict();

export const updateTemplateAttachmentSchema = Joi.object({
    ...base,
}).strict();
