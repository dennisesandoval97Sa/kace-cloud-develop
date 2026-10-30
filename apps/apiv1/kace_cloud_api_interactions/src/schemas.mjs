import Joi from 'joi';
import { importedInteractionStateValidationError } from '@kace/core/src/interactions/application/create/InteractionStateImportPolicy.js';

const requiredIdentityFields = {
    id: Joi.string().uuid().required(),
    channel_id: Joi.string().required(),
    client_identifier: Joi.string().required(),
    external_identifier: Joi.string().required(),
};

const optionalIdentityFields = {
    id: Joi.string().uuid().optional(),
    channel_id: Joi.string().optional(),
    client_identifier: Joi.string().optional(),
    external_identifier: Joi.string().optional(),
};

const base = {
    description: Joi.string().allow('', null),
    priority: Joi.string(),
    workspace_id: Joi.string(),
    email_id: Joi.string().uuid().allow(null).optional(),
    conversation_id: Joi.string(),
    receipt_at: Joi.date().iso(),
    closed_at: Joi.date().iso().allow(null),
    closed_by: Joi.string().allow(null).optional(),
    is_closed: Joi.boolean().allow(null).optional(),
    is_migrated: Joi.boolean().allow(null).optional(),
};

const reviewLockFields = {
    start_review_at: Joi.date().iso().allow(null),
    start_review_by: Joi.string().uuid().allow(null),
    in_review: Joi.boolean().allow(null).optional(),
};

function validateImportedState(value, helpers) {
    const reason = importedInteractionStateValidationError(value);
    if (reason) return helpers.error('any.invalid', { reason });

    return value;
}

export const interactionCreate = Joi.object({
    ...requiredIdentityFields,
    ...base,
    ...reviewLockFields,
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
})
    .custom(validateImportedState, 'imported interaction state')
    .messages({ 'any.invalid': '{{#label}} {{#reason}}' });

export const interactionUpdate = Joi.object({
    ...optionalIdentityFields,
    ...base,
    updated_at: Joi.date().timestamp().optional(),
    updated_by: Joi.string().uuid().optional(),
});

export const interactionDelete = Joi.object({
    ...requiredIdentityFields,
    ...base,
    ...reviewLockFields,
    deleted_at: Joi.date().timestamp().optional(),
    deleted_by: Joi.string().uuid().optional(),
});
