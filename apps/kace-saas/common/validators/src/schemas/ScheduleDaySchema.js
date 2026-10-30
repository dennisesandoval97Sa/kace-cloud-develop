import Joi from "joi";

export const ScheduleDayCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    dia_semana: Joi.string().max(100).min(5),
    es_laboral: Joi.boolean().required(),
    hora_inicio_jornada: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
    hora_fin_jornada: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
    horario_id: Joi.string().uuid(),
    status: Joi.number().integer(),
});

export const ScheduleDayUpdateSchema = Joi.object({
    es_laboral: Joi.boolean(),
    hora_inicio_jornada: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    hora_fin_jornada: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    status: Joi.number().integer(),
});
