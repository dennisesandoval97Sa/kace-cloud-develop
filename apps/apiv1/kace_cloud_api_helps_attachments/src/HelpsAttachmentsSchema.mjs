import Joi from 'joi';

const base = {
    path: Joi.string().max(50).required(),
    tipo: Joi.string().max(100).required(),
    help_id: Joi.string().uuid(),
};

export const HelpsAttachmentsCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    ...base,
    created_at: Joi.date().timestamp(),
    created_by: Joi.string().uuid(),
});
