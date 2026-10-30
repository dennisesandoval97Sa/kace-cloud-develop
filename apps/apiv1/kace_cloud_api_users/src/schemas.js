import Joi from 'joi';

const base = {
    login: Joi.string().max(100).min(1),
    is_active: Joi.number().integer().max(2),
    nombres: Joi.string().max(100).min(1),
    apellido1: Joi.string().max(100).min(1),
    apellido2: Joi.string().max(100).allow(''),
    email: Joi.string().email({ tlds: { allow: false } }),
    telefono: Joi.string().max(10).allow(''),
    movil: Joi.string().max(10).allow(''),
    password: Joi.when('account_type', {
        is: 1,
        then: Joi.string().allow('', null).optional(),
        otherwise: Joi.string().max(100).min(1),
    }),
    external_id: Joi.string().max(45).allow('', null),
    grid: Joi.object().allow(''),
    rol_id: Joi.string().uuid(),
    account_type: Joi.number().integer().valid(1, 2).required(),
    grupo_activo: Joi.string().uuid().allow('').when('account_type', {
        is: 2,
        then: Joi.required(),
    }),
    codigos_externos: Joi.object(),
    filters: Joi.object(),
    auxUser: Joi.object(),
    data: Joi.object(),
    ips_allowed: Joi.object(),
};

export const schemaCreate = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    // User requires a role: without it ValueObjectUuid throws a plain Error and the create answered 500.
    rol_id: Joi.string().uuid().required(),
    group_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const schemaUpdate = Joi.object({
    ...base,
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional(),
});

export const bulkUpdateUsersSchema = Joi.object({
    user_ids: Joi.array().items(Joi.string().uuid()).min(1).max(500).required(),
    data: Joi.object({
        login: Joi.string().max(100).min(1),
        is_active: Joi.number().integer().max(2),
        nombres: Joi.string().max(100).min(1),
        apellido1: Joi.string().max(100).min(1),
        apellido2: Joi.string().max(100).allow(''),
        email: Joi.string().email({ tlds: { allow: false } }),
        telefono: Joi.string().max(10).allow(''),
        movil: Joi.string().max(10).allow(''),
        external_id: Joi.string().max(45).allow('', null),
        grid: Joi.object().allow(''),
        rol_id: Joi.string().uuid(),
        account_type: Joi.number().integer().valid(1, 2),
        grupo_activo: Joi.string().uuid().allow(''),
        codigos_externos: Joi.object(),
        filters: Joi.object(),
        auxUser: Joi.object(),
        data: Joi.object(),
        ips_allowed: Joi.object(),
        last_integration_active_at: Joi.date().iso(),
    })
        .min(1)
        .required()
        .unknown(false),
}).unknown(false);

export const auxUserCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    usuario_id: Joi.string().uuid().required().required(),
    data: Joi.object().required(),
    created_at: Joi.date().iso().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const auxUserUpdateSchema = Joi.object({
    data: Joi.object(),
    updated_at: Joi.date().iso().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});

export const searchByNameSchema = Joi.object({
    name: Joi.string().max(100).min(1).required(),
});

export const sessionSchema = Joi.object({
    user_id: Joi.string().uuid().allow(null).messages({
        'string.guid': 'El campo user_id debe ser un UUID válido',
    }),
});

export const integrationActivitySchema = Joi.object({
    timestamp: Joi.date().iso().required().messages({
        'date.format': 'El campo timestamp debe ser una fecha ISO 8601 válida',
        'any.required': 'El campo timestamp es requerido',
    }),
});

export const updateActiveGroupSchema = Joi.object({
    grupo_activo: Joi.string().uuid().required(),
}).unknown(false);

export const validateGroupQuerySchema = Joi.object({
    group_id: Joi.string().uuid().required().messages({
        'string.guid': 'El campo group_id debe ser un UUID válido',
        'any.required': 'El campo group_id es requerido',
    }),
});
