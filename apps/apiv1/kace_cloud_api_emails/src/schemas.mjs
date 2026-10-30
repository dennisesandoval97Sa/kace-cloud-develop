import Joi from 'joi';

const uuidSchema = Joi.string().uuid().optional();
const isoDateSchema = Joi.date().timestamp().optional();
const urlSchema = Joi.string().uri().max(2048);
const sha256Schema = Joi.string().hex().length(64);

const externalEmailBodyPartSchema = Joi.object({
    s3_url: urlSchema.required(),
    size_bytes: Joi.number().integer().min(0).required(),
    content_type: Joi.string().max(255).allow(null, '').optional(),
    sha256: sha256Schema.required(),
});

const recipientSchema = Joi.array().items(
    Joi.object({
        name: Joi.string().max(100).required(),
        email: Joi.string().email().required(),
    })
);

export const emailBodySchema = Joi.object({
    id: uuidSchema.required(),
    email_id: uuidSchema,
    body: Joi.string().max(5000).required(),
    body_html: Joi.string().allow(null, '').optional(),
    text: externalEmailBodyPartSchema.optional(),
    html: externalEmailBodyPartSchema.optional(),
    created_at: isoDateSchema,
    updated_at: isoDateSchema,
    deleted_at: isoDateSchema.allow(null),
    created_by: uuidSchema,
    updated_by: uuidSchema,
    deleted_by: uuidSchema.allow(null),
})
    .custom((value, helpers) => {
        if (value.body_html && value.html?.s3_url) {
            return helpers.error('any.invalid', {
                message: 'body.body_html cannot be provided when body.html.s3_url is provided.',
            });
        }

        return value;
    })
    .messages({
        'any.invalid': 'body.body_html cannot be provided when body.html.s3_url is provided.',
    });

export const emailAttachmentSchema = Joi.object({
    id: uuidSchema.required(),
    email_id: uuidSchema,
    url: urlSchema,
    size: Joi.number().integer().min(0),
    filename: Joi.string().max(255).allow(null, '').optional(),
    name: Joi.string().max(255).allow(null, '').optional(),
    created_at: isoDateSchema,
    updated_at: isoDateSchema,
    deleted_at: isoDateSchema.allow(null),
    created_by: uuidSchema,
    updated_by: uuidSchema,
    deleted_by: uuidSchema.allow(null),
});

export const emailSchema = Joi.object({
    id: uuidSchema,
    s3_key: urlSchema,
    subject: Joi.string().max(255),
    sender: Joi.string().email(),
    to: recipientSchema.required(),
    cc: recipientSchema.allow(null),
    bcc: recipientSchema.allow(null),
    priority: Joi.string(),
    workspace_id: uuidSchema,
    message_id: Joi.string(),
    account_id: uuidSchema,
    received_at: Joi.date().iso(),
    is_outbound: Joi.boolean(),
    body: emailBodySchema,
    attachments: Joi.array().items(emailAttachmentSchema),
    created_at: Joi.date().iso(),
    updated_at: Joi.date().iso().allow(null),
    deleted_at: isoDateSchema.allow(null),
    created_by: uuidSchema,
    updated_by: uuidSchema,
    deleted_by: uuidSchema.allow(null),
});
