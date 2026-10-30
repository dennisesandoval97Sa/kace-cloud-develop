import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const baseSchemaCreate = Joi.object({
    usuario_id: JoiHelper.uuid().required(),
    grupo_id: JoiHelper.uuid().required(),
});

const baseSchemaUpdate = Joi.object({
    usuario_id: JoiHelper.uuid().allow(""),
    grupo_id: JoiHelper.uuid().allow(""),
});

export const relUsersGroupCreateSchema = Joi.array().items(baseSchemaCreate).required();
export const relUsersGroupUpdateSchema = Joi.array().items(baseSchemaUpdate);
