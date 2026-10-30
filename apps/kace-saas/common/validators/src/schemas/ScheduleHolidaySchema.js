import Joi from "joi";

export const ScheduleHolidayCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    fecha: Joi.date().required(),
    horario_id: Joi.string().uuid(),
    status: Joi.number().integer(),
});

export const ScheduleHolidayUpdateSchema = Joi.object({
    fecha: Joi.date().required(),
    status: Joi.number().integer(),
});
