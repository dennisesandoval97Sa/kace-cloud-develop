import Joi from "joi";

export const SchedulePayloadCreateSchema = Joi.object({
    schedule: Joi.object().required(),
    days: Joi.array().required(),
    holidays: Joi.array().required(),
}).strict();
