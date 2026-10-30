import Joi from 'joi';

const targetPattern = /^[A-Za-z][A-Za-z0-9]*$/;

const target = Joi.string().min(1).max(200).pattern(targetPattern).required().messages({
    'string.pattern.base': "target must be the CDK Stack id (alphanumeric), e.g. 'UsersStack'.",
});

export const schemaEnable = Joi.object({
    target,
    minutes: Joi.number().integer().min(1).max(60).required(),
    level: Joi.number().integer().valid(1, 2).default(1),
}).unknown(false);

export const schemaDisable = Joi.object({
    target,
}).unknown(false);

export const schemaStatusPath = Joi.object({
    target,
});
