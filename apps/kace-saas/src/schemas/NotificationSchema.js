import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    subject: JoiHelper.legacyText({ max: 25 }).required(),
    message: JoiHelper.legacyText({ max: 1000 }).required(),
    start_date: JoiHelper.date({ iso: true }).required().strict(false),
    end_date: JoiHelper.date({ iso: true }).required().strict(false),
    is_read: Joi.boolean().allow(null).optional(),
    read_by: JoiHelper.uuid().allow(null).optional(),
    is_active: JoiHelper.boolean(),
};

export const ClientNotificationFormSchema = Joi.object({
    ...base,
    client_id: JoiHelper.uuid().required(),
}).strict();
