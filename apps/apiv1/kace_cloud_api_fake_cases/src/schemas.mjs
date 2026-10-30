import Joi from 'joi';

const schemaBase = {
    cliente_id: Joi.string().uuid().allow(null, ''),
    transicion_id: Joi.string().uuid().allow(null, ''),
    responsable_id: Joi.string().uuid().allow(null, ''),
    clasificacion_id: Joi.string().uuid().allow(null, ''),
    descripcion_caso_id: Joi.string().uuid().allow(null, ''),
    descripcion_caso: Joi.string().max(5000).allow(null, ''),
    mail_item_id: Joi.string().allow(null, ''),
    canal_id: Joi.string().allow(null, ''),
    grupo_id: Joi.string().uuid().allow(null, ''),
    fecha_resolucion: Joi.date().allow(null, ''),
    motivo_baja: Joi.string().min(3).max(100).allow(null, ''),
    alto_impacto: Joi.number().min(0).max(1),
    vista: Joi.string().allow(null, ''),
};

export const schemaCreate = Joi.object({
    ...schemaBase,
    cliente_id: schemaBase.cliente_id,
    transicion_id: schemaBase.transicion_id,
    responsable_id: schemaBase.responsable_id,
    clasificacion_id: schemaBase.clasificacion_id,
    grupo_id: schemaBase.grupo_id,
    id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
