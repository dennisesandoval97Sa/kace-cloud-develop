import { JoiHelper } from "@/utils/src/utils/joi.helper";
import Joi from "joi";

export const BrokerAdapterCreateSchema = Joi.object({
    id: Joi.string().uuid().optional(),
    name: JoiHelper.legacyText().required(),
    host: JoiHelper.host().required(),
    port: Joi.number().integer().min(1).max(65535).optional(),
    queue: JoiHelper.legacyText().required(),
    exchange: Joi.string().max(255).allow(null).optional(),
    vhost: JoiHelper.generalText().allow(null).optional(),
    username: JoiHelper.generalText().allow(null).optional(),
    password: JoiHelper.generalText().allow(null).optional(),
    created_at: Joi.date().timestamp().allow(null),
    created_by: Joi.string().uuid().allow(null),
});
