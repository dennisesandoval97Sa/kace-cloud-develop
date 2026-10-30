import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const UploadFileSchemaForm = Joi.object({
    delimiter: JoiHelper.freeText().valid(",", ";").required(),
}).strict();
