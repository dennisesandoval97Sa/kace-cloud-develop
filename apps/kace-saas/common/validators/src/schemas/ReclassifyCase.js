import Joi from "joi";

const baseSchema = {
    clasification_id: Joi.string().uuid().required(),
    transition_id: Joi.string().uuid().required(),
};
export const ReclassifyCase = Joi.object(baseSchema);
