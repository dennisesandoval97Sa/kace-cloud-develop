import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const addUserToGroupSchema = Joi.object({
    usuario_id: JoiHelper.uuid().required(),
}).strict();

export const addGroupToUserSchema = Joi.object({
    grupo_id: JoiHelper.uuid().required(),
}).strict();

export const batchAddUserGroupSchema = Joi.array().items(
    Joi.object({
        usuario_id: JoiHelper.uuid().required(),
        grupo_id: JoiHelper.uuid().required(),
    }),
).required();

export const batchRemoveUserGroupSchema = Joi.array().items(
    Joi.object({
        usuario_id: JoiHelper.uuid().required(),
        grupo_id: JoiHelper.uuid().required(),
    }),
).required();
