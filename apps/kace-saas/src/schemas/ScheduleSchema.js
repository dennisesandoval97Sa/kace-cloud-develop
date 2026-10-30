import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    id: JoiHelper.uuid(),
    nombre: JoiHelper.legacyText({ max: 100 }).required(),
    status: JoiHelper.integer(),
};

export const ScheduleCreateSchema = Joi.object({ ...base }).strict();
export const ScheduleUpdateSchema = Joi.object({ ...base }).strict();
export const ScheduleSchemaForm = Joi.object({
    nombre: base.nombre.required(),
}).strict();
