import Joi from 'joi';

const validateDateRange = (value, helpers) => {
    if (value?.fecha_inicio > value?.fecha_fin) {
        return helpers.message('La fecha de inicio no puede ser mayor que la fecha de fin');
    }
    return value;
};

const base = {
    asunto: Joi.string().max(300),
    mensaje: Joi.string().max(1000),
    fecha_inicio: Joi.date(),
    fecha_fin: Joi.date(),
    leida: Joi.boolean(),
    leida_por: Joi.string().uuid().allow(null),
    user_id: Joi.string().uuid(),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
};

export const schemaCreate = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    asunto: base.asunto.required(),
    mensaje: base.mensaje.required(),
    fecha_inicio: base.fecha_inicio.required(),
    fecha_fin: base.fecha_fin.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
}).custom(validateDateRange, 'Date range validation');

export const schemaUpdate = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
}).custom(validateDateRange, 'Date range validation');
