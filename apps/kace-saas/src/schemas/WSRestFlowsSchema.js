import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    description: JoiHelper.legacyText({ max: 255 }).required(),
    external_code: JoiHelper.legacyText().required(),
    is_active: JoiHelper.boolean(),
    is_primary: JoiHelper.boolean().default(true),
    json_diagram_properties: Joi.object(),
    initial_context: Joi.object(),
};

export const WSRestFlowCreateSchema = Joi.object({
    ...base,
    id: JoiHelper.uuid(),
}).strict();

export const WSRestFlowUpdateSchema = Joi.object({
    ...base,
}).strict();
