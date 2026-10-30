import Joi from "joi";

const base = {
    id: Joi.string().uuid(),
    nombre: Joi.string().max(100).required(),
    status: Joi.number().integer(),
};

export const ScheduleCreateSchema = Joi.object({
    ...base,
});

export const ScheduleUpdateSchema = Joi.object({
    ...base,
});

export const ScheduleSchemaForm = Joi.object({
    nombre: base.nombre.required(),
});
