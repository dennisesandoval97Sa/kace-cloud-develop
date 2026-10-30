import Joi from "joi";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const timeSchema = Joi.object({
    start: Joi.string()
        .pattern(timePattern, "time")
        .messages({
            "string.pattern.name": "Start time must be in the format HH:mm, using 24-hour time (e.g., 13:45).",
        }),
    end: Joi.string()
        .pattern(timePattern, "time")
        .messages({
            "string.pattern.name": "End time must be in the format HH:mm, using 24-hour time (e.g., 13:45).",
        }),
});

const daysSchema = Joi.object({
    monday: timeSchema.optional(),
    tuesday: timeSchema.optional(),
    wednesday: timeSchema.optional(),
    thursday: timeSchema.optional(),
    friday: timeSchema.optional(),
    saturday: timeSchema.optional(),
    sunday: timeSchema.optional(),
});

export const shiftManagementBase = Joi.object({
    description: Joi.string().max(1000).required(),
    holiday_dates: Joi.array().items(
        Joi.string().regex(datePattern).message("Holiday dates must be in the format YYYY-MM-DD"),
    ).default([]),
    work_days: daysSchema,
});

export const shiftManagementSchema = shiftManagementBase.keys({
    id: Joi.string().uuid(),
    created_at: Joi.date().timestamp(),
    updated_at: Joi.date().timestamp().allow(null),
    deleted_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid(),
    updated_by: Joi.string().uuid().allow(null),
    deleted_by: Joi.string().uuid().allow(null),
});

export const createShiftManagementSchema = shiftManagementSchema.keys({
    id: Joi.required(),
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const updateShiftManagementSchema = shiftManagementSchema.keys({
    id: Joi.forbidden(),
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional(),
});
