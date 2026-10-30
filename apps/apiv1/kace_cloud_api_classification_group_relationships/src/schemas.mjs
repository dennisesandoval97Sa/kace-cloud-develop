import Joi from 'joi';

const schemaBase = {
    group_id: Joi.string().uuid().required(),
    classification_id: Joi.string().uuid().required(),
    form: Joi.string().allow(null).optional(),
};

export const createSchema = Joi.object(schemaBase);

export const updateSchema = Joi.object({
    ...schemaBase,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
