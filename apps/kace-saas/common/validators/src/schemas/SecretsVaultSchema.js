import Joi from "joi";

export const SecretsVaultCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    descripcion: Joi.string().max(255).required(),
    referencia: Joi.string().max(255).required(),
    secreto: Joi.string().required(),
    created_by: Joi.string().uuid().required(),
    created_at: Joi.date().required(),
});

export const SecretsVaultUpdateSchema = Joi.object({
    descripcion: Joi.string().max(255),
    referencia: Joi.string().max(255),
    secreto: Joi.string(),
    updated_by: Joi.string().uuid().required(),
    updated_at: Joi.date().required(),
});

const SecretsVaultSchemaBase = Joi.object({
    id: Joi.string().uuid(),
    descripcion: Joi.string().max(255).required(),
    referencia: Joi.string().max(255).required(),
    secreto: Joi.string().required(),
});

export const SecretsVaultCreateSchemaForm = SecretsVaultSchemaBase;
