import Joi from 'joi';

const base = {
    template_id: Joi.string().uuid().required(),
    classification_id: Joi.string().uuid().required(),
};

export const createClassificationTemplateSchema = Joi.object(base);

export const batchAddClassificationTemplateSchema = Joi.array().items(Joi.object(base)).required();

export const batchRemoveClassificationTemplateSchema = Joi.array().items(Joi.object(base)).required();
