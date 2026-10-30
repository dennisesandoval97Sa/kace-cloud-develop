import Joi from 'joi';

export const createSchema = Joi.object({
    title: Joi.string().trim().min(1).max(100).required(),

    url: Joi.string()
        .trim()
        .max(500)
        .uri({ scheme: ['http', 'https'] })
        .required(),

    position: Joi.number().integer().min(0).optional(),
});
