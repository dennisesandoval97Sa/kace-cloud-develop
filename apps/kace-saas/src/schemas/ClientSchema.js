import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const ClientCreateSchemaForm = {
    tipo_cliente: Joi.string().valid("Natural", "Comercial"),
    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: validar contra literales. Se debe definir en la configuracion
     */
    tipo_documento: Joi.string(),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: ampliar 45 caracteres, validar contra literales
     */
    documento: JoiHelper.documentNumber(),
    nombres: JoiHelper.legacyText({ max: 300 }).allow(null, ""),
    apellido1: JoiHelper.legacyText(),
    apellido2: JoiHelper.legacyText(),
    nombre_empresa: Joi.when("tipo_cliente", {
        is: "Comercial",

        /**
         * NO-SONAR: Comentario necesario para futuro refactor
         * TODO: validar contra literales. Se debe definir en la configuracion
         */
        then: JoiHelper.legacyText().required(),
        otherwise: JoiHelper.legacyText().allow(null, ""),
    }),
    sexo: JoiHelper.legacyText(),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: validar contra literales
     */
    estado_civil: JoiHelper.legacyText(),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: validar contra literales
     */
    fecha_nacimiento: Joi.when("tipo_cliente", {
        is: "Natural",

        /**
         * NO-SONAR: Comentario necesario para futuro refactor
         * TODO: validar contra literales. Se debe definir en la configuracion
         */
        then: JoiHelper.date(),
        otherwise: JoiHelper.date().optional(),
    }),
    email: JoiHelper.email().allow(null, ""),
    email_alterno: JoiHelper.email().allow(null, ""),
    telefono: JoiHelper.legacyText(),
    telefono_alterno: JoiHelper.legacyText(),
    campos_extra1: JoiHelper.legacyText().allow(""),
    campos_extra2: JoiHelper.legacyText().allow(""),
    campos_extra3: JoiHelper.legacyText().allow(""),
    status: JoiHelper.integer(),
    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: cambiar por "is_active" (bool)
     */
    padre_id: JoiHelper.uuid().allow(null, ""),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: cambiar por "client_parent_id"
     */
    habeas_data: JoiHelper.legacyText(),

    /**
     * NO-SONAR: Comentario necesario para futuro refactor
     * TODO: validar contra enum
     */
    contactos: Joi.array().items(JoiHelper.uuid()).optional(),
};
