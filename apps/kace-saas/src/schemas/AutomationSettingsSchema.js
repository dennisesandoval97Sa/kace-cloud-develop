import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    description: JoiHelper.freeText().required(),
    frequency: JoiHelper.crontab(),
    start_date: JoiHelper.date({ iso: true }).required(),
    end_date: JoiHelper.date({ iso: true }).required(),
};

export const AutomationSettingsCreateSchema = Joi.object({
    ...base,
    id: JoiHelper.uuid(),
}).strict();

export const AutomationSettingsUpdateSchema = Joi.object({
    ...base,
    id: JoiHelper.uuid().required(),
}).strict();
