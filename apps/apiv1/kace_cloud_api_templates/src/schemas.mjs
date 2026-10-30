import Joi from 'joi';

const schemaBase = {
    tipo: Joi.number().integer(),
    descripcion: Joi.string().max(100),
    destinatario: Joi.string().max(100000),
    copia: Joi.string().max(100000).allow(null, ''),
    copia_oculta: Joi.string().max(100000).allow(null, ''),
    asunto: Joi.string().max(150),
    cuerpo: Joi.string().max(100000),
    ruta: Joi.string().max(1000).allow(null, ''),
    incluye_adjuntos: Joi.boolean(),
    enviar_adjuntos_del_caso: Joi.boolean(),
    status: Joi.number().integer(),
};

const schemaBaseRequiredFields = {
    tipo: schemaBase.tipo.required(),
    descripcion: schemaBase.descripcion.required(),
    destinatario: schemaBase.destinatario.required(),
    asunto: schemaBase.asunto.required(),
    cuerpo: schemaBase.cuerpo.required(),
    status: schemaBase.status.required(),
};

export const schemaCreate = Joi.object({
    ...schemaBase,
    ...schemaBaseRequiredFields,
    id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
