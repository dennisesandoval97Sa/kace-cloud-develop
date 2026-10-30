import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const timeSchema = Joi.object({
    start: JoiHelper.timeHHMM(),
    end: JoiHelper.timeHHMM(),
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
    description: JoiHelper.description({ max: 1000 }).required(),
    holiday_dates: Joi.array().items(
        Joi.string().isoDate().message("Holiday dates must be in the format YYYY-MM-DD"),
    ).default([]),
    work_days: daysSchema,
}).strict();
