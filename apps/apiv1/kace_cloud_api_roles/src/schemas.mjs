import Joi from 'joi';

const permisos = Joi.object()
    .pattern(
        Joi.string().valid('agente', 'administrador', 'auxiliaries', 'search'),
        Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                description: Joi.string().required(),
                granted: Joi.boolean().required(),
                module_id: Joi.string().required(),
            })
        )
    )
    .required();

export const schemaCreate = Joi.object({
    id: Joi.string().uuid(),
    descripcion: Joi.string().max(100).required(),
    permisos: permisos,
    status: Joi.number().integer().required(),
    created_at: Joi.date().required(),
    created_by: Joi.string().uuid().required(),
});

export const schemaUpdate = Joi.object({
    descripcion: Joi.string().max(100),
    permisos: permisos,
    status: Joi.number().integer(),
    updated_at: Joi.date(),
    updated_by: Joi.string().uuid(),
    deleted_at: Joi.date(),
    deleted_by: Joi.string().uuid(),
});
