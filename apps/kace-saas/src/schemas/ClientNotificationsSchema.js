import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const ClientNotificationCreateSchema = Joi.object({
    client_id: JoiHelper.uuid().required(),
    subject: JoiHelper.legacyText({ max: 25 }),
    message: JoiHelper.legacyText({ max: 1000 }),
    start_date: JoiHelper.date({ iso: true }),
    end_date: JoiHelper.date({ iso: true }),
    is_read: Joi.boolean().allow(null).optional(),
    read_by: JoiHelper.uuid().allow(null).optional(),
    is_active: JoiHelper.boolean(),
}).strict();
