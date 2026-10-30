import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const ScheduleHolidayCreateSchema = Joi.object({
    id: JoiHelper.uuid(),
    fecha: JoiHelper.date().required(),
    horario_id: JoiHelper.uuid(),
    status: JoiHelper.integer(),
}).strict();

export const ScheduleHolidayUpdateSchema = Joi.object({
    fecha: JoiHelper.date().required(),
    status: JoiHelper.integer(),
}).strict();
