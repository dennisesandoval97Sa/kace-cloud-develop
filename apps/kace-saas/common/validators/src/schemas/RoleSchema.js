import Joi from "joi";

export const RoleCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    descripcion: Joi.string().max(100).required(),
    permisos: Joi.string(),
    status: Joi.number().integer().required(),
    created_at: Joi.date().required(),
    created_by: Joi.string().uuid().required(),
});

export const RoleSchemaForm = Joi.object({
    id: Joi.string().uuid(),
    descripcion: Joi.string().max(100).required(),
    permisos: Joi.string(),
    status: Joi.number().integer().required(),
});

export const RoleUpdateSchema = Joi.object({
    descripcion: Joi.string().max(100),
    permisos: Joi.string(),
    status: Joi.number().integer(),
    updated_at: Joi.date(),
    updated_by: Joi.string().uuid(),
    deleted_at: Joi.date(),
    deleted_by: Joi.string().uuid(),
});
