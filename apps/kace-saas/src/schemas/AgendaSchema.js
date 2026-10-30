import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const AgendaSchemaForm = Joi.object({
    id: JoiHelper.uuid(),
    description: JoiHelper.freeText().required(),
    daily_limit: JoiHelper.integer({ min: 0, max: 1000 }).required(),
    is_active: JoiHelper.boolean().required(),
    is_for_weekend: JoiHelper.boolean().required(),
    one_script_id: JoiHelper.uuid(),
    groups: Joi.array().required(),
}).strict();
