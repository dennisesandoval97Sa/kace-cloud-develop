import Joi from 'joi';

export const CaseSessionDurationCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    case_id: Joi.string().uuid().required(),
    event_type: Joi.string().valid('PAUSED', 'FINISHED','VIEW','CANCELLED'),
    justification: Joi.string().allow('').optional(),
});

export const CaseSessionDurationUpdateSchema = Joi.object({
    justification: Joi.string().allow('').optional(),
    next_event_type: Joi.string().valid('PAUSED', 'FINISHED', 'VIEW', 'CANCELLED'),
});