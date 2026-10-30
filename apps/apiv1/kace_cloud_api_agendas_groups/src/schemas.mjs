import Joi from 'joi';

const schemaBase = Joi.object({
    agenda_id: Joi.string().uuid().required(),
    group_id: Joi.string().uuid().required(),
});

export const createSchema = schemaBase;
export const deleteSchema = schemaBase;
export const batchSchema = Joi.array().items(schemaBase);
