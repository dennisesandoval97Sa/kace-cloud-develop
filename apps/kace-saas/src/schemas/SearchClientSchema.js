import Joi from "joi";

export const SearchClientSchema = Joi.object({
    payload: Joi.string().required(),
    type: Joi.string().required(),
}).strict();
