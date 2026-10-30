import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    group_id: JoiHelper.uuid().required(),
    classification_id: JoiHelper.uuid().required(),
    form: Joi.string().allow(null).optional(),
};

export const createClassificationGroupSchema = Joi.object(base).strict();
export const addClassificationToGroupSchema = Joi.object({
    classification_id: base.classification_id,
    form: base.form,
}).strict();

export const addGroupToClassificationSchema = Joi.object({
    group_id: base.group_id,
    form: base.form,
}).strict();

export const batchAddClassificationGroupSchema = Joi.array().items(Joi.object(base)).required();

export const batchRemoveClassificationGroupSchema = Joi.array().items(Joi.object({
    classification_id: base.classification_id,
    group_id: base.group_id,
})).required();
