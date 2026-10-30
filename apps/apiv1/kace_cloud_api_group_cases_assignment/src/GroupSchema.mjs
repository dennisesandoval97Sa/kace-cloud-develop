import Joi from 'joi';
export const AssignCasesGroup = Joi.object({
    cases: Joi.array().required(),
});
