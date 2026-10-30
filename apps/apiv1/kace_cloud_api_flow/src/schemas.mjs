import Joi from 'joi';

const edgeSchema = Joi.object({
    id: Joi.string().allow(null, ''),
    source: Joi.alternatives().try(Joi.string().valid('0'), Joi.string().uuid()).required(),
    target: Joi.string().uuid().required(),
    sourceHandle: Joi.any().allow(null),
    targetHandle: Joi.any().allow(null),
    ans_id: Joi.string().uuid().allow(null),
    rule_id: Joi.string().uuid().allow(null),
    data: Joi.object({
        is_visible: Joi.boolean().default(true),
    })
        .unknown(true)
        .default({ is_visible: true }),
}).unknown(true);

const jsonFlujoSchema = Joi.object({
    nodes: Joi.array().required(),
    edges: Joi.array().items(edgeSchema).required(),
}).unknown(true);

export const createSchema = Joi.object({
    id: Joi.string().uuid(),
    nombre: Joi.string().max(100).required(),
    json_flujo: jsonFlujoSchema.required(),
    status: Joi.number().integer().allow(null),
    created_at: Joi.string().isoDate().allow(null),
    created_by: Joi.string().uuid().allow(null),
}).strict();

export const updateSchema = Joi.object({
    nombre: Joi.string().max(100).min(1),
    json_flujo: jsonFlujoSchema,
    status: Joi.number().integer().allow(null),
    updated_at: Joi.string().isoDate().allow(null),
    updated_by: Joi.string().uuid().allow(null),
}).strict();
