import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const TransitionRuleSchemaForm = Joi.object({
    nombre: JoiHelper.legacyText({ min: 1, max: 255 }).required(),
    conditions: Joi.object().unknown(true).required(),
}).strict();
