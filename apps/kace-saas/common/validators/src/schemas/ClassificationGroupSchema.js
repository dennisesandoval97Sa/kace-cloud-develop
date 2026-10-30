import Joi from "joi";

const base = {
    group_id: Joi.string().uuid().required(),
    classification_id: Joi.string().uuid().required(),
    form: Joi.string().allow(null).optional(),
};

export const createClassificationGroupSchema = Joi.object(base);

export const addClassificationToGroupSchema = Joi.object({
    classification_id: base.classification_id,
    form: base.form,
});

export const addGroupToClassificationSchema = Joi.object({
    group_id: base.group_id,
    form: base.form,
});

export const batchAddClassificationGroupSchema = Joi.array().items(
    Joi.object(base),
).required();

export const batchRemoveClassificationGroupSchema = Joi.array().items(
    Joi.object({
        classification_id: base.classification_id,
        group_id: base.group_id,
    }),
).required();
