import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const literalSchemaForm = Joi.object({
    tipo_literal: JoiHelper.uuid().allow(null),
    nombre: JoiHelper.legacyText({ max: 255 }).required(),
    is_active: JoiHelper.boolean(),
}).strict();
