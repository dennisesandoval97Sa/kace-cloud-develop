import Joi from 'joi';

const diagramScheme = Joi.object({
    nodes: Joi.array().min(1).required().messages({
        'array.min': 'At least one node is required',
        'array.base': 'Nodes must be an array',
    }),
    edges: Joi.array().messages({
        'array.base': 'The "edges" property, when it exists, must be an array',
    }),
}).unknown(true);

const base = {
    description: Joi.string().max(255),
    external_code: Joi.string().max(255),
    json_diagram_properties: diagramScheme,
    initial_context: Joi.object().unknown(true).allow(null),
    is_active: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.boolean()),
    is_primary: Joi.boolean().default(true),
};

export const WSRestFlowCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    description: base.description.required(),
    external_code: base.external_code.required(),
    json_diagram_properties: base.json_diagram_properties.required(),
    is_active: base.is_active.required().default(true),
    is_primary: Joi.boolean().required().default(true),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const WSRestFlowUpdateSchema = Joi.object({
    ...base,
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
