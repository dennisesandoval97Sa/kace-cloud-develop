import Joi from 'joi';

const schemaBase = {
    id_token: Joi.string(),
    access_token: Joi.string(),
    refresh_token: Joi.string(),
    token_type: Joi.string(),
    expires_in: Joi.number().integer(),
};

const CLIENT_FINGERPRINT = Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
        'any.required': 'Missing required HTTP header: X-Client-Fingerprint',
        'string.pattern.base':
            'Invalid X-Client-Fingerprint format. Only alphanumeric characters, hyphens, and underscores are allowed.',
    });

export const createSchema = Joi.object({
    ...schemaBase,
    clientFingerprint: CLIENT_FINGERPRINT,
    created_at: Joi.date().timestamp(),
    force: Joi.boolean().optional(),
});

export const schemaServiceAccount = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
    clientFingerprint: CLIENT_FINGERPRINT,
});

export const logoutSchema = Joi.object({
    user_id: Joi.string().uuid().allow(null).messages({
        'string.guid': 'El campo user_id debe ser un UUID válido',
    }),
    client_id: Joi.string().required(),
    id_token: Joi.string().required(),
});
