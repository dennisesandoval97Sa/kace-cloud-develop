import Joi from 'joi';

export const schemaBase = Joi.object({
    level: Joi.string()
        .valid('nivel1', 'nivel2', 'nivel3', 'nivel4', 'nivel5', 'nivel6', 'nivel7', 'nivel8', 'nivel9', 'nivel10')
        .required(),
});
