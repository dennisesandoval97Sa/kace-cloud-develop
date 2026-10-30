import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const TimeSlotsSchemaForm = Joi.object({
    id: JoiHelper.uuid(),
    description: JoiHelper.legacyText({ min: 3, max: 255 }).required().allow(null),
    start_time: JoiHelper.timeHHMMSS().required(),
    end_time: JoiHelper.timeHHMMSS().required(),
    max_appointments: JoiHelper.integer({ min: 0, max: 1000 }).required().allow(null),
    agenda_id: JoiHelper.uuid().required(),
    is_active: JoiHelper.boolean(),
}).strict();
