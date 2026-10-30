import Joi from 'joi';

export const WSHookRestFlowSchema = Joi.object({
    flow_id: Joi.string().uuid().empty(''),
    external_code: Joi.string().empty(''),
    initial_context: Joi.object(),
}).xor('flow_id', 'external_code');
