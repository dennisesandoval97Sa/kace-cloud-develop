import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const AllowedConnectionForm = Joi.object({
    description: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    connection: JoiHelper.legacyText({ max: 255 }).required(),
    has_ssl: JoiHelper.boolean(),
    certificate: Joi.when("has_ssl", {
        switch: [
            {
                is: Joi.valid(true, 1).required(),
                then: JoiHelper.legacyText().empty("").required(),
            },
            {
                is: Joi.valid(false, 0).required(),
                then: JoiHelper.legacyText().valid(null, "").optional(),
            },
        ],
        otherwise: JoiHelper.legacyText().allow(null, "").optional(),
    }),
    is_active: JoiHelper.boolean(),
}).strict();
