import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const groupSchema = Joi.object({
    id: JoiHelper.uuid().required(),
});

export const GroupListSchemaForm = Joi.object({
    descripcion: JoiHelper.description({ min: 3, max: 255 }).required(),
    is_active: JoiHelper.boolean(),
    lista_grupos: Joi.array().items(groupSchema),
}).strict();
