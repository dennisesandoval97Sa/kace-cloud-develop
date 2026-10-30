import Joi from 'joi';

const schemaBase = {
    group_id: Joi.string().uuid().required(),
    classification_id: Joi.string().uuid().required(),
    form: Joi.string().allow(null).optional(),
};

export const createSchema = Joi.array()
    .items(
        Joi.object({
            classification_id: schemaBase.classification_id,
            group_id: schemaBase.group_id,
        })
    )
    .required();
