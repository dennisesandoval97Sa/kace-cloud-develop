import Joi from 'joi';

const PeriodSchema = Joi.object({
    field: Joi.string().required(),
    initialDate: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/)
        .required(),
    endDate: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/)
        .required(),
});

const ConditionSchema = Joi.object({
    field: Joi.string().required(),
    operator: Joi.string()
        .valid('notNull', 'null', 'equals', 'neq', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'between')
        .required(),
    value: Joi.any().allow(null),
    type: Joi.string().valid('AND', 'OR').default('AND'),
});

export const ReportPayloadSchema = Joi.object({
    report: Joi.string().required(),
    period: PeriodSchema.required(),
    conditions: Joi.array().items(ConditionSchema).default([]),
});
