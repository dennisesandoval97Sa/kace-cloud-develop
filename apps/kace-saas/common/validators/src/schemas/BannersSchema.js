import Joi from "joi";

const dateValidation = (value, helpers) => {
    if (value.fecha_inicio > value.fecha_fin) {
        return helpers.message(
            "La fecha de inicio no puede ser mayor que la fecha de fin",
        );
    }
    return value;
};

const statusSchema = Joi.number().integer().valid(1, 2).required();

const BannerBaseSchema = Joi.object({
    id: Joi.string().uuid(),
    descripcion: Joi.string().max(300).required(),
    propiedades: Joi.object({
        position: Joi.string().required(),
        icon: Joi.string().required(),
        color: Joi.string().required(),
    }).required(),
    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: Igualar reglas del Agregado
     */
    especificaciones: Joi.object({
        users: Joi.array().items(Joi.string().uuid()).allow(null),
        groups: Joi.array().items(Joi.string().uuid()).allow(null),
        clients: Joi.array().items(Joi.string().uuid()).allow(null),
    }).required(),
    fecha_inicio: Joi.date().required(),
    fecha_fin: Joi.date()
        .required()
        .greater(Joi.ref("fecha_inicio"))
        .messages({ "date.greater": "La fecha de fin debe ser mayor que la fecha de inicio" }),
    status: statusSchema,
});

export const BannersCreateSchema = BannerBaseSchema.keys({
    created_at: Joi.date().timestamp().required(),
    created_by: Joi.string().uuid().required(),
}).custom(dateValidation, "Validación fechas");

export const BannerCreateSchemaForm = BannerBaseSchema;

export const BannersUpdateSchema = Joi.object({
    descripcion: Joi.string().max(300),
    propiedades: Joi.object(),
    especificaciones: Joi.object(),
    fecha_inicio: Joi.date(),
    fecha_fin: Joi.date(),
    status: statusSchema.optional(),
    updated_at: Joi.date().iso().required(),
    updated_by: Joi.string().uuid().required(),
}).custom(dateValidation, "Validación fechas");
