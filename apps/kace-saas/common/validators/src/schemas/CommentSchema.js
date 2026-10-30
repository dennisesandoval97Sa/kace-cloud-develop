import Joi from "joi";

const descripcionSchema = Joi.string().min(3).max(5000);
const descripcionRequiredSchema = descripcionSchema.required();
const calificacionSchema = Joi.number().integer().min(1).max(10).allow(null);

export const CommentsCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    descripcion: descripcionRequiredSchema,
    calificacion: calificacionSchema,
    caso_id: Joi.string().uuid().required(),
    created_at: Joi.date().timestamp().required(),
    created_by: Joi.string().uuid().required(),
});

export const CommentsUpdateSchema = Joi.object({
    descripcion: descripcionSchema,
    calificacion: calificacionSchema,
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().required(),
});

export const CommentUpdateSchemaForm = Joi.object({
    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: Para que se usa??
     */
    descripcion: descripcionRequiredSchema,
    calificacion: calificacionSchema,
}).messages({
    "any.required": "Requerido",
});
