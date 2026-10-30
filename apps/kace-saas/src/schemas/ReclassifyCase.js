import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const baseSchema = {
    clasification_id: JoiHelper.uuid().required(),
    transition_id: JoiHelper.uuid().required(),
};

export const ReclassifyCase = Joi.object(baseSchema).strict();
