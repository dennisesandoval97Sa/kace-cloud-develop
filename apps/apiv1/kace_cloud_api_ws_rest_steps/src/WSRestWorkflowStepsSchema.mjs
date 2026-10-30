import Joi from 'joi';

const base = {
    flow_id: Joi.string().uuid(),
    order: Joi.number(),
    endpoint_id: Joi.string().uuid().allow(null),
    function_id: Joi.string().uuid().allow(null),
    conditional_id: Joi.string().uuid().allow(null),
};

/**
 * @param {object} obj - The object to validate.
 * @param {Joi.CustomHelpers} helpers - The Joi custom helpers.
 */
const validateOneNotNullField = (obj, helpers) => {
    const endpointId = obj?.endpoint_id;
    const functionId = obj?.function_id;
    const conditionalId = obj?.conditional_id;

    const setCount = [endpointId, functionId, conditionalId].filter(Boolean).length;

    if (setCount !== 1) {
        return helpers.error('object.xor');
    }

    return obj;
};

export const WSRestWorkflowStepCreateSchema = Joi.object({
    ...base,
    id: Joi.string().uuid().required(),
    flow_id: base.flow_id.required(),
    order: base.order.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
}).custom(validateOneNotNullField, 'exactly one of endpoint_id, function_id, or conditional_id');

export const WSRestWorkFlowStepUpdateSchema = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
