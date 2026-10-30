import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    template_id: JoiHelper.uuid().required(),
    classification_id: JoiHelper.uuid().required(),
};

export const createClassificationTemplateSchema = Joi.object(base).strict();
export const batchAddClassificationTemplateSchema = Joi.array().items(Joi.object(base)).required();
export const batchRemoveClassificationTemplateSchema = Joi.array().items(Joi.object(base)).required();
