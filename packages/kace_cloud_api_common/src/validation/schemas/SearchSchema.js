import Joi from 'joi';
import { FILTER_TYPE } from '@kace/core/src/shared/criteria/FilterType';
import { COMPARISION_OPERATORS } from '@kace/core/src/shared/criteria/FilterOperator';
import { RELATIONSHIPS_TYPES } from '@kace/core/src/shared/criteria/RelationshipType';
import { ALLOWED_CRITERIA_FUNCTIONS } from '@kace/core/src/shared/criteria/allowedCriteriaFunctions';

const havingCondition = Joi.object({
    column: Joi.string().required(),
    operator: Joi.string()
        .valid(...Object.keys(COMPARISION_OPERATORS))
        .required(),
    value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array()).allow(null),
});

const select = Joi.array().items(Joi.string().min(1)).unique().messages({
    'array.unique': 'Los campos de select deben ser únicos.',
});

const distinct = Joi.alternatives().try(Joi.boolean()).messages({
    'alternatives.match': 'Distinct debe ser un booleano',
});

const groupBy = Joi.array().items(Joi.string().min(1)).unique().messages({
    'array.unique': 'Los campos de group_by deben ser únicos.',
});

const conditionalFunctionNames = Object.values(ALLOWED_CRITERIA_FUNCTIONS.conditional_functions);

const filterFunctionValue = Joi.object({
    function: Joi.string()
        .valid(...conditionalFunctionNames)
        .required(),
    value: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null),
});

const filterSimple = Joi.object({
    field: Joi.string().required(),
    operator: Joi.string()
        .valid(...Object.keys(COMPARISION_OPERATORS))
        .required(),
    value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), filterFunctionValue).required().allow(''),
    type: Joi.string()
        .valid(...Object.values(FILTER_TYPE))
        .required(),
    entity: Joi.string().optional().allow(null),
});

const filterGroup = Joi.object({
    groupType: Joi.string()
        .valid(...Object.values(FILTER_TYPE))
        .required(),
    filters: Joi.array().items(filterSimple).min(1).required(),
});

const relationshipObject = Joi.object({
    table: Joi.string().required(),
    condition: Joi.object().required(),
    type: Joi.string()
        .valid(...Object.values(RELATIONSHIPS_TYPES))
        .required(),
});

export const SearchSchema = Joi.object({
    filter: Joi.array().items(Joi.alternatives().try(filterSimple, filterGroup)).allow(null),
    limit: Joi.number().required().allow(null),
    offset: Joi.number().required().allow(null),
    order: Joi.object().allow(null),
    relationship: Joi.array().items(relationshipObject).allow(null),
    select,
    distinct,
    group_by: groupBy,
    having: Joi.array().items(havingCondition).allow(null),
});

export const VisibleUpdateSchema = SearchSchema.keys({
    is_visible: Joi.boolean().required().default(true),
});
