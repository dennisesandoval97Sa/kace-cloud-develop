import Joi from "joi";
import { FILTER_TYPE } from "../../../../src/kace/shared/criteria/FilterType";
import { COMPARISION_OPERATORS } from "../../../../src/kace/shared/criteria/FilterOperator";
import { RELATIONSHIPS_TYPES } from "../../../../src/kace/shared/criteria/RelationshipType";

const filter = Joi.object({
    field: Joi.string().required(),
    operator: Joi.string()
        .valid(...Object.keys(COMPARISION_OPERATORS))
        .required(),
    value: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
    type: Joi.string()
        .valid(...Object.values(FILTER_TYPE))
        .required(),
});

const relationshipObject = Joi.object({
    table: Joi.string().required(),
    condition: Joi.object().required(),
    type: Joi.string()
        .valid(...Object.values(RELATIONSHIPS_TYPES))
        .required(),
});

export const SearchSchemaSearchSchema = Joi.object({
    filter: Joi.array().items(filter).allow(null),
    limit: Joi.number().required().allow(null),
    offset: Joi.number().required().allow(null),
    order: Joi.object().allow(null),
    relationship: Joi.array().items(relationshipObject).allow(null),
});
