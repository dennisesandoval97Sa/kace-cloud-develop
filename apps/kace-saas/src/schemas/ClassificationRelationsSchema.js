import Joi from "joi";

export const ClassificationRelationsForm = Joi.object({
    form: Joi.string().uuid().allow(null).optional(),
});
