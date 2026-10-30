import Joi from "joi"

const base = {
    login: Joi.string().max(100).min(1),
    status: Joi.number().integer().max(2),
    nombres: Joi.string().max(100).min(1),
    apellido1: Joi.string().max(100).min(1),
    apellido2: Joi.string().max(100).allow(""),
    email: Joi.string().email({ tlds: { allow: false } }),
    telefono: Joi.string().max(10).allow(""),
    movil: Joi.string().max(10).allow(""),
    password: Joi.string().max(100).min(1),
    external_id: Joi.string().max(45).allow("", null),
    grid: Joi.object().allow(""),
    rol_id: Joi.string().uuid(),
    grupo_activo: Joi.string().uuid().allow(""),
    codigos_externos: Joi.object(),
    filters: Joi.object(),
    account_type: Joi.number().integer().valid(1, 2)
}

export const UserCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional()
})

export const UserUpdateSchema = Joi.object({
    ...base,
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional()
})

export const UserLoginSchema = Joi.object({
    login: base.login.required(),
    password: base.password.required()
})
export const AssignCasesUser = Joi.object({
    grupo_id: Joi.string().uuid().allow(""),
    cases: Joi.array().required()
})
