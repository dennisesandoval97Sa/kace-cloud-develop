import Joi from 'joi';

const base = {
    usuario_id: Joi.string().uuid().required(),
    grupo_id: Joi.string().uuid().required(),
};

export const batchAddUserGroupSchema = Joi.array().items(Joi.object(base)).required();

export const batchRemoveUserGroupSchema = Joi.array().items(Joi.object(base)).required();
