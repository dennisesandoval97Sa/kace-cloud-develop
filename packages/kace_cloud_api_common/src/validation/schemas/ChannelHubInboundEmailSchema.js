import Joi from 'joi';

const emailAddressSchema = Joi.string()
    .max(120)
    .custom((value, helpers) => {
        return /^IMCEAEX-/i.test(value) ? helpers.error('string.email') : value;
    }, 'Exchange X.500 address rejection')
    .email();

const splitCommaSeparatedEmails = (value) =>
    String(value)
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);

const commaSeparatedRecipientSchema = Joi.string().custom((value, helpers) => {
    const emails = splitCommaSeparatedEmails(value);

    if (emails.length === 0) {
        return helpers.error('string.email');
    }

    const hasInvalidEmail = emails.some((email) => emailAddressSchema.validate(email).error);

    if (hasInvalidEmail) {
        return helpers.error('string.email');
    }

    return value;
}, 'comma-separated recipient email list validation');

const recipientSchema = Joi.alternatives().try(
    emailAddressSchema,
    Joi.object({
        email: emailAddressSchema.required(),
        name: Joi.string().allow(null, ''),
    }).unknown(true)
);

const recipientListSchema = Joi.alternatives().try(recipientSchema, commaSeparatedRecipientSchema);

const optionalRecipientSchema = Joi.alternatives().try(
    Joi.valid(''),
    recipientListSchema,
    Joi.array().items(recipientSchema)
);

const RECIPIENT_FIELDS = ['to', 'cc', 'bcc'];

const hasRecipientValue = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(value));

const requireAtLeastOneRecipient = (destination, helpers) => {
    const hasRecipient = RECIPIENT_FIELDS.some((field) => hasRecipientValue(destination[field]));

    return hasRecipient ? destination : helpers.error('object.nonEmptyRecipient');
};

const attachmentObjectSchema = Joi.object({
    url: Joi.string().uri().required(),
    filename: Joi.string().max(255).allow(null, '').optional(),
    name: Joi.string().max(255).allow(null, '').optional(),
    fileName: Joi.string().max(255).allow(null, '').optional(),
    content_type: Joi.string().max(255).allow(null, '').optional(),
    contentType: Joi.string().max(255).allow(null, '').optional(),
    size: Joi.number().integer().min(0).optional(),
}).unknown(true);

const attachmentUrlSchema = Joi.string()
    .uri()
    .custom((value) => ({ url: value }), 'Channel Hub attachment URL normalization');

const attachmentSchema = Joi.alternatives().try(attachmentObjectSchema, attachmentUrlSchema);

export const channelHubSchema = Joi.object({
    messageId: Joi.string().max(255).required(),
    messageIdOperator: Joi.string().max(255).optional(),
    operatorDate: Joi.string().isoDate().allow(null, '').optional(),
    threadId: Joi.string().trim().max(255).allow('', null).optional(),
    origin: Joi.alternatives()
        .try(
            emailAddressSchema,
            Joi.object({
                email: emailAddressSchema.required(),
                name: Joi.string().allow(null, ''),
            }).unknown(true)
        )
        .required(),
    subject: Joi.string().max(500),
    connectionId: Joi.string().trim().min(1).max(255).required(),
    tag: Joi.string().trim().max(50).allow('', null).optional(),
    destination: Joi.object({
        to: optionalRecipientSchema,
        cc: optionalRecipientSchema,
        bcc: optionalRecipientSchema,
    })
        .or('to', 'cc', 'bcc')
        .custom(requireAtLeastOneRecipient, 'at least one recipient validation')
        .messages({
            'object.nonEmptyRecipient': '{{#label}} must contain at least one non-empty recipient',
        })
        .required()
        .unknown(true),
    content: Joi.object({
        text: Joi.string().uri().required(),
        html: Joi.string().uri().optional(),
    })
        .required()
        .unknown(true),
    attachments: Joi.array().items(attachmentSchema).optional(),
}).options({ allowUnknown: true });
