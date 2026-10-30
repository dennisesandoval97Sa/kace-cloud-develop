import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const TimeFilterSchema = Joi.object({
    field: Joi.string().valid("created_at", "updated_at", "fecha").required(),
    interval: Joi.number().integer().min(1).required(),
    unit: Joi.string().valid("hours", "days", "weeks", "months").required(),
    reference: Joi.string().valid("now", "start_of_day", "start_of_month").required(),
});

const FormattingSchema = Joi.object({
    separator: Joi.string().max(1).optional(),
    encoding: Joi.string().optional(),
    nullValue: Joi.string().allow("").optional(),
    valueQuotes: Joi.boolean().optional(),
    headerQuotes: Joi.boolean().optional(),
    includeHeader: Joi.boolean().optional(),
    lineTerminator: Joi.string().optional(),
});

const DetailsSchema = Joi.object({
    formatting: FormattingSchema.optional(),
}).unknown(true);

export const GenerateCsvCreateSchemaForm = Joi.object({
    id: JoiHelper.uuid(),
    description: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    is_active: JoiHelper.boolean().default(true),
    frequency: Joi.string().valid("hours", "days", "weeks", "months").required(),
    interval: JoiHelper.integer({ min: 1, max: 365 }).required(),
    time_filter: TimeFilterSchema.required(),
    storage_path: JoiHelper.internalPath().required(),
    next_execution_at: JoiHelper.date().required(),
    start_time: JoiHelper.timeHHMM().required(),
    views: Joi.array().items(JoiHelper.legacyText({ min: 3, max: 255 })).min(1).required().messages({ "array.min": "array.min" }),
    details: DetailsSchema.optional(),
}).strict();
