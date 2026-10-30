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

export const ReportExecutionPayloadSchema = Joi.object({
    // Report name
    name: Joi.string().min(1).required(),
    // Who requested the report (uuid string)
    issuedBy: Joi.string()
        .guid({ version: ['uuidv4', 'uuidv5'] })
        .required(),
    // Period for the report
    period: PeriodSchema.required(),
    // Optional conditions to filter the report (stored as JSON)
    conditions: Joi.array().items(ConditionSchema).default([]),
    // Optional precomputed S3 file location (mostly assigned after generation)
    s3File: Joi.string().uri({ allowRelative: false }).optional().allow(null),
    // Optional created_by user id (uuid)
    createdBy: Joi.string()
        .guid({ version: ['uuidv4', 'uuidv5'] })
        .optional()
        .allow(null),
});
