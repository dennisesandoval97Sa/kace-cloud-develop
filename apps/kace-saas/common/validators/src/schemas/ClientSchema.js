import Joi from "joi";
import { TYPE_DOCUMENT } from "../../../../apps/kace-admin/src/utils/main";

/**
 * NO-SONAR: Comentario necesario para futuro refactor
 * TODO: Validacion dinamica. ¿validar contra literales?  ¿tipo de cliente es más adecuado?
 */
const naturalUserValidation = Joi.string().max(100).when("tipo_documento", {
    is: TYPE_DOCUMENT.NIT,
    then: Joi.optional(),
    otherwise: Joi.required(),
});

export const ClientCreateSchema = Joi.object({
    id: Joi.string().uuid(),

    tipo_cliente: Joi.string().valid("Natural", "Comercial").required(),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: validar contra literales. Se debe definir en la configuracion
     */
    tipo_documento: Joi.string().required().max(15),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: ampliar 45 caracteres, validar contra literales
     */
    documento: Joi.string().required().max(15),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: ampliar 45 caracteres
     */
    nombres: naturalUserValidation,

    apellido1: naturalUserValidation,
    apellido2: Joi.string().max(100),

    nombre_empresa: Joi.alternatives().conditional("tipo_cliente", {
        is: "Comercial",

        /**
         * NO-SONAR: Comentario necesario para futuro refactor
         * TODO: validar contra literales. Se debe definir en la configuracion
         */
        then: Joi.string().required().max(100),
        otherwise: Joi.string().max(100),
    }),

    sexo: Joi.string().max(15),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: validar contra literales
     */
    estado_civil: Joi.string().max(15),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: validar contra literales
     */
    fecha_nacimiento: Joi.alternatives().conditional("tipo_cliente", {
        is: "Natural",

        /**
         * NO-SONAR: Comentario necesario para futuro refactor
         * TODO: validar contra literales. Se debe definir en la configuracion
         */
        then: Joi.date(),
        otherwise: Joi.date().optional(),
    }),

    email: Joi.string().email({ tlds: { allow: false } }).allow(null, ""),
    email_alterno: Joi.string().email({ tlds: { allow: false } }).allow(null, ""),
    telefono: Joi.string().max(15),
    telefono_alterno: Joi.string().max(15),
    campos_extra1: Joi.string().allow("").max(100),
    campos_extra2: Joi.string().allow("").max(100),
    campos_extra3: Joi.string().allow("").max(100),
    status: Joi.number().integer().max(10),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: cambiar por "is_active" (bool)
     */
    padre_id: Joi.string().uuid().allow(null, ""),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: cambiar por "client_parent_id"
     */
    habeas_data: Joi.string().max(10),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: validar contra enum
     */
    contactos: Joi.array().items(Joi.string().uuid()).when("tipo_documento", {
        is: TYPE_DOCUMENT.NIT,

        /**
         * NO-SONAR: Comentario necesario para futuro refactor
         * TODO: Validacion dinamica. ¿validar contra literales?  ¿tipo de cliente es más adecuado?
         */
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),

    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const ClientUpdateSchema = Joi.object({
    tipo_documento: Joi.string().max(15).min(1),
    tipo_cliente: Joi.string().valid("Natural", "Comercial").required(),
    documento: Joi.string().max(15).min(1),
    nombres: Joi.string().max(100).min(1),
    apellido1: Joi.string().max(100).min(1),
    apellido2: Joi.string().max(100).min(1),
    sexo: Joi.string().max(15).min(1),
    estado_civil: Joi.string().max(15).min(1),
    fecha_nacimiento: Joi.date(),
    email: Joi.string().email({ tlds: { allow: false } }),
    email_alterno: Joi.string().email({ tlds: { allow: false } }),
    telefono: Joi.string().max(15).min(1),
    telefono_alterno: Joi.string().max(15).min(1),
    campos_extra1: Joi.string().allow("").max(100),
    campos_extra2: Joi.string().allow("").max(100),
    campos_extra3: Joi.string().allow("").max(100),
    status: Joi.number().integer().max(10).min(1),
    habeas_data: Joi.string().max(10).min(1),
    padre_id: Joi.string().uuid().allow(null, ""),
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional(),
});

export const ParentUpdateSchema = () =>
    Joi.object({
        padre_id: Joi.string().uuid(),
        habeas_data: Joi.string().max(10).min(1),
    });
