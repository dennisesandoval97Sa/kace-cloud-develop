import Joi from "joi";

export const addUserToGroupSchema = Joi.object({
    usuario_id: Joi.string().uuid().required(),
});

export const addGroupToUserSchema = Joi.object({
    grupo_id: Joi.string().uuid().required(),
});

export const batchAddUserGroupSchema = Joi.array().items(
    Joi.object({
        usuario_id: Joi.string().uuid().required(),
        grupo_id: Joi.string().uuid().required(),
    }),
).required();

export const batchRemoveUserGroupSchema = Joi.array().items(
    Joi.object({
        usuario_id: Joi.string().uuid().required(),
        grupo_id: Joi.string().uuid().required(),
    }),
).required();
