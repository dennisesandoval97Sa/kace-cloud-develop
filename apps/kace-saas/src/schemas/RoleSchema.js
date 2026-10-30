import { JoiHelper } from "@/utils/src/utils/joi.helper";
import Joi from "joi";

export const RoleSchemaForm = Joi.object({
    descripcion: JoiHelper.description({ min: 3, max: 100 }).required(),
    permisos: Joi.object(),
    status: JoiHelper.integer().required(),
}).strict();
