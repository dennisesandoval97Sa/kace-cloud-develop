import Joi from 'joi';
import { importedInteractionStateValidationError } from '@kace/core/src/interactions/application/create/InteractionStateImportPolicy.js';

// Business fields only. The server generates `id` and the audit fields
// (`created_at`, `created_by`) per item via secureObjectCreatePayload, mirroring
// the single-create endpoint. Limits are kept in sync with the interactions API
// schemas.js `interactionCreate`.
// `priority`, `workspace_id` and `conversation_id` are non-nullable value objects in
// Interaction, so requiring them here turns what would be a 500 in the middle of the
// transaction into a clean per-item 400.
const itemBase = {
    channel_id: Joi.string().required(),
    client_identifier: Joi.string().required(),
    external_identifier: Joi.string().required(),
    description: Joi.string().allow('', null),
    priority: Joi.string().required(),
    workspace_id: Joi.string().required(),
    email_id: Joi.string().uuid().allow(null).optional(),
    conversation_id: Joi.string().required(),
    receipt_at: Joi.date().iso(),
    closed_at: Joi.date().iso().allow(null),
    closed_by: Joi.string().allow(null).optional(),
    is_closed: Joi.boolean().allow(null).optional(),
    is_migrated: Joi.boolean().allow(null).optional(),
    start_review_at: Joi.date().iso().allow(null),
    start_review_by: Joi.string().uuid().allow(null),
    in_review: Joi.boolean().allow(null).optional(),
};

function validateImportedState(value, helpers) {
    const reason = importedInteractionStateValidationError(value);
    if (reason) return helpers.error('any.invalid', { reason });

    return value;
}

// The upper bound matches the bulk endpoints of cases (see
// apps/apiv1/kace_cloud_api_cases_bulk/src/schemas.mjs): the whole batch runs in a single
// transaction, so an unbounded array would hold locks until the Lambda times out.
export const MAX_BATCH_SIZE = 500;

const itemSchema = Joi.object(itemBase)
    .custom(validateImportedState, 'imported interaction state')
    .messages({ 'any.invalid': '{{#label}} {{#reason}}' });

export const createSchema = Joi.array().items(itemSchema).min(1).max(MAX_BATCH_SIZE).required();
