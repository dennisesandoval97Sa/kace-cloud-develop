import Joi from 'joi';

const interactionIds = Joi.array().items(Joi.string().uuid()).min(1).max(500).required();

export const schemaBulkMove = Joi.object({
    interaction_ids: interactionIds,
    workspace_id: Joi.string().uuid().required(),
});

export const schemaBulkClose = Joi.object({
    interaction_ids: interactionIds,
    motive: Joi.string().trim().min(1).required(),
});

export const schemaBulkDelete = Joi.object({
    interaction_ids: interactionIds,
    motive: Joi.string().trim().min(1).required(),
});
