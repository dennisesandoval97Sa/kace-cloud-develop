import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const ActionSchemaForm = Joi.object({
    action_type: JoiHelper.identifier().required(),
    description: JoiHelper.legacyText().required(),
    conditions: Joi.object().unknown(true).required(),
    triggers: Joi.array().allow(null),
    permissions: Joi.object().unknown(true).allow(null),
    state_id: JoiHelper.uuid().allow(null),
    group_id: JoiHelper.uuid().allow(null),
    responsible_id: JoiHelper.uuid().allow(null),
    template_id: JoiHelper.uuid().allow(null).when("action_type", {
        is: "envio_correo",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    automation_id: Joi.when("triggers", {
        is: Joi.array().has(Joi.string().valid("cron_job")),
        then: JoiHelper.uuid().required(),
        otherwise: JoiHelper.uuid().allow(null, "").optional(),
    }),
    mail_account_id: JoiHelper.uuid().allow(null).when("action_type", {
        is: "envio_correo",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    advisor_list_id: JoiHelper.uuid().allow(null).when("action_type", {
        is: "asignar_lista_asesores",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    group_list_id: JoiHelper.uuid().allow(null).when("action_type", {
        is: "asignar_lista_grupos",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    ws_rest_flow_id: JoiHelper.uuid().allow(null).when("action_type", {
        is: "consumo_rest_flow",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    model_update_id: JoiHelper.uuid().allow(null).when("action_type", {
        is: "actualizar_modelo",
        then: Joi.string().uuid().required(),
        otherwise: Joi.forbidden(),
    }),
    external_group_code: JoiHelper.externalCode().allow(null).when("action_type", {
        is: "asignar_grupo_por_codigo_externo",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    external_user_code: JoiHelper.externalCode().allow(null).when("action_type", {
        is: "asignar_usuario_por_codigo_externo",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    external_group_dynamic_code: JoiHelper.externalCode().allow(null).when("action_type", {
        is: "asignar_grupo_por_codigo_externo_dinamico",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    external_user_dynamic_code: JoiHelper.externalCode().allow(null).when("action_type", {
        is: "asignar_usuario_por_codigo_externo_dinamico",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    priority: Joi.number().integer().min(1).max(99).required(),
    is_active: Joi.boolean().default(true),
}).strict();
