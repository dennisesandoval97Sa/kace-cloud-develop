import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const usuarioSchema = Joi.object({
    id: JoiHelper.uuid().required(),
});

export const UserListSchemaForm = Joi.object({
    id: JoiHelper.uuid().optional(),
    descripcion: JoiHelper.description({ min: 3, max: 255 }).required(),
    lista_usuarios: Joi.array().items(usuarioSchema),
    is_active: JoiHelper.boolean(),
}).strict();
