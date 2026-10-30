import Joi from 'joi';

const schemaBase = {
    group_id: Joi.string().uuid().required(),
    classification_id: Joi.string().uuid().required(),
    form: Joi.string().allow(null).optional(),
};

export const createSchema = Joi.array().items(Joi.object(schemaBase)).required();
