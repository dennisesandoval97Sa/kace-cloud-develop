import Joi from 'joi';

export const InteractionJoinCaseSchema = Joi.object({
    interaction_id: Joi.string().uuid().required(),
    caso_id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});
