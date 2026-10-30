import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const GroupSelectUserSchema = Joi.object({
    idGroup: JoiHelper.uuid().required().messages({
        "string.empty": "groupConfiguration.required",
        "any.required": "groupConfiguration.required",
        "string.guid": "groupConfiguration.required",
    }),
}).strict();
