import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    case_id: JoiHelper.uuid(),
    description: JoiHelper.legacyText({ max: 255 }),
    size: JoiHelper.integer(),
    path: JoiHelper.legacyText({ max: 1000 }),
    type: JoiHelper.integer({ min: 0, max: 32767 }),
    is_active: JoiHelper.boolean(),
};

export const createCaseAttachmentSchema = Joi.object({
    id: JoiHelper.uuid().required(),
    ...base,
    case_id: base.case_id.required(),
}).strict();

export const updateCaseAttachmentSchema = Joi.object({
    ...base,
}).strict();
