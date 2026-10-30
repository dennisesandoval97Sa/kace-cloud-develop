import Joi from "joi";
import { RegexPatterns } from "../utils/regex/RegexPatterns";

const FILTER_TYPE = {
    AND: "AND",
    OR: "OR",
};
const COMPARISION_OPERATORS = {
    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: faltan los operadores para busquedas de JSONB
     */
    eq: "=",
    neq: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    between: "between",
    in: "in",
    notIn: "not in",
    like: "like",
    null: "null",
    notNull: "notNull",
    jsonContains: "json contains",
    jsonArrayValue: "json array value",
};
const RELATIONSHIPS_TYPES = {
    join: "join",
    left: "left",
    right: "right",
};

const filter = Joi.object({
    field: Joi.string()
        .pattern(RegexPatterns.extendedCharactersRegex())
        .message("string.extendedCharactersRegex")
        .required(),
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

export const SearchSchema = Joi.object({
    filter: Joi.array().items(filter).allow(null),
    limit: Joi.number().required().allow(null),
    offset: Joi.number().required().allow(null),
    order: Joi.object().allow(null),
    relationship: Joi.array().items(relationshipObject).allow(null),
});
