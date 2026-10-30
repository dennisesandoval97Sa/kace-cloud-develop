import Joi from 'joi';

export const uploadFileSchema = Joi.object({
    fileName: Joi.string().max(255).required(),
    contentType: Joi.string().max(255).required(),
    url: Joi.string().max(255).required(),
    id: Joi.string().max(255).required(),
});

export const validateScanFileSchema = Joi.object({
    fileName: Joi.string().max(255).required(),
    url: Joi.string().max(255).required(),
    id: Joi.string().uuid().required(),
});
