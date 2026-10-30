import Joi from 'joi';

export const ExportTableDataSchema = Joi.object({
    tableName: Joi.string().required(),
    criteria: Joi.object().optional(),
    headers: Joi.array().items(Joi.string()).optional(),
    userData: Joi.object({
        mail: Joi.string().email().required(),
        id: Joi.string().required(),
        login: Joi.string().required(),
        nombres: Joi.string().required(),
        apellido1: Joi.string().required(),
        apellido2: Joi.string().optional(),
        telefono: Joi.string().optional(),
        movil: Joi.string().optional(),
    }),
});
