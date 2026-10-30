import Joi from "joi";

const baseSchemaCreate = Joi.object({
    usuario_id: Joi.string()
        .guid({ version: ["uuidv4"] })
        .required(),
    grupo_id: Joi.string()
        .guid({ version: ["uuidv4"] })
        .required(),
});

const baseSchemaUpdate = Joi.object({
    usuario_id: Joi.string().uuid().allow(""),
    grupo_id: Joi.string().uuid().allow(""),
});

export const relUsersGroupCreateSchema = Joi.array()
    .items(baseSchemaCreate)
    .required();

export const relUsersGroupUpdateSchema = Joi.array().items(baseSchemaUpdate);
