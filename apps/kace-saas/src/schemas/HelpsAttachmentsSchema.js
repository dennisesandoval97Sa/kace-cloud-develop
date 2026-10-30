import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    path: JoiHelper.legacyText({ max: 50 }).required(),
    tipo: JoiHelper.generalText({ max: 100 }).required(),
    help_id: JoiHelper.uuid(),
};

export const HelpsAttachmentsCreateSchema = Joi.object({
    id: JoiHelper.uuid().required(),
    ...base,
}).strict();
