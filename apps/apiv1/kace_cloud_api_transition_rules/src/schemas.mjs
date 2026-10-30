import Joi from 'joi';

const VALID_OPERATORS = [
    '=',
    '!=',
    '<',
    '>',
    '<=',
    '>=',
    'contains',
    'beginsWith',
    'endsWith',
    'doesNotContain',
    'doesNotBeginWith',
    'doesNotEndWith',
    'null',
    'notNull',
    'isEmpty',
    'isNotEmpty',
    'in',
    'notIn',
    'between',
    'notBetween',
];

const VALID_TYPES = ['manual_input', 'options_list', 'entity', 'function'];
const VALID_VALUE_TYPES = ['text', 'number', 'date'];

const ruleSchema = Joi.object({
    id: Joi.string().uuid(),
    field: Joi.string().required(),
    operator: Joi.string()
        .valid(...VALID_OPERATORS)
        .required(),
    value: Joi.alternatives()
        .try(
            Joi.string().allow(''),
            Joi.number(),
            Joi.boolean(),
            Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number())),
            Joi.allow(null)
        )
        .when('operator', {
            is: Joi.valid('null', 'notNull', 'isEmpty', 'isNotEmpty'),
            then: Joi.optional().allow('', null),
            otherwise: Joi.required(),
        }),
    type: Joi.string()
        .valid(...VALID_TYPES)
        .allow(''),
    value_type: Joi.string()
        .valid(...VALID_VALUE_TYPES)
        .allow(''),
    valueSource: Joi.string(),
});

const conditionsSchema = Joi.object({
    id: Joi.string().uuid(),
    combinator: Joi.string().valid('and', 'or').required(),
    not: Joi.boolean(),
    rules: Joi.array()
        .items(Joi.alternatives().try(ruleSchema, Joi.link('#conditionsSchema')))
        .min(1)
        .required(),
}).id('conditionsSchema');

const schemaBase = {
    nombre: Joi.string().max(255),
    conditions: conditionsSchema,
    entity: Joi.string().max(255).allow(null, ''),
};

export const schemaCreate = Joi.object({
    ...schemaBase,
    id: Joi.string().uuid().required(),
    nombre: schemaBase.nombre.required(),
    status: Joi.number().integer().required(),
    conditions: schemaBase.conditions.required(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});

export const schemaUpdate = Joi.object({
    ...schemaBase,
    status: Joi.number().integer(),
    updated_at: Joi.date().allow(null),
    updated_by: Joi.string().uuid().allow(null),
});
