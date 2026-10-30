import Joi from "joi";
import { MailAccountsTypes } from "@/enums/MailAccountTypes";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const MailAccountsForms = Joi.object({
    description: JoiHelper.generalText({ min: 3, max: 120 }).required(),
    type: Joi.string()
        .valid(...Object.values(MailAccountsTypes.toJson()))
        .required(),
    host: Joi.when("type", {
        is: "smtp",
        then: JoiHelper.host().required(),
        otherwise: JoiHelper.host().allow(null, ""),
    }),
    port: Joi.when("type", {
        is: "smtp",
        then: JoiHelper.integer().required(),
        otherwise: JoiHelper.integer().allow(null),
    }),
    protocol: Joi.when("type", {
        is: "smtp",
        then: Joi.string().valid("smtp").required(),
        otherwise: Joi.string().valid("smtp").allow(null, ""),
    }),
    encryption: Joi.string().valid("tls", "ssl").allow(null, ""),
    username: Joi.when("type", {
        is: "smtp",
        then: Joi.string().max(255).required(),
        otherwise: Joi.string().max(255).allow(null, ""),
    }),
    password: Joi.when("type", {
        is: "smtp",
        then: JoiHelper.legacyText({ max: 1000 }).required(),
        otherwise: JoiHelper.legacyText({ max: 1000 }).allow(null, ""),
    }),
    from_address: JoiHelper.legacyText({ max: 1500 }).allow(null, ""),
    from_name: JoiHelper.generalText({ max: 250 }).allow(null, ""),
    tenant_id: Joi.when("type", {
        is: Joi.valid(MailAccountsTypes.MS_GRAPH_APPLICATION.value, MailAccountsTypes.MS_GRAPH_USER.value),
        then: JoiHelper.legacyText({ max: 1000 }).required(),
        otherwise: JoiHelper.legacyText({ max: 1000 }).allow(null, ""),
    }),
    client_id: Joi.when("type", {
        is: Joi.not(MailAccountsTypes.SMTP.value),
        then: JoiHelper.legacyText({ max: 1000 }).required(),
        otherwise: JoiHelper.legacyText({ max: 1000 }).allow(null, ""),
    }),
    client_secret: Joi.when("type", {
        is: Joi.not(MailAccountsTypes.SMTP.value),
        then: Joi.string().max(1000).required(),
        otherwise: JoiHelper.legacyText({ max: 1000 }).allow(null, ""),
    }),
    code: Joi.string().max(1000).allow(null, ""),
    refresh_token: Joi.string().allow(null, ""),
    mails_download_limit: JoiHelper.integer().allow(null),
    login_endpoint: JoiHelper.uri().allow(null, ""),
    graph_scope: Joi.string().max(255).allow(null, ""),
    start_syncing_from: Joi.alternatives()
        .try(
            JoiHelper.date({ iso: true }),
            Joi.string()
                .pattern(/^\d{4}-\d{2}-\d{2}$/)
                .message("date.format"),
        )
        .allow(null),
    last_synchronization: Joi.alternatives()
        .try(
            JoiHelper.date({ iso: true }),
            Joi.string()
                .pattern(/^\d{4}-\d{2}-\d{2}$/)
                .message("date.format"),
        )
        .allow(null),
    folders: Joi.array().allow(null),
    access_token: Joi.string().allow(null, ""),
    email_account: JoiHelper.legacyText({ max: 1500 }).allow(null, ""),
    vault: Joi.boolean().allow(null),
    vault_data: Joi.object().allow(null),
    is_active: Joi.alternatives().try(Joi.number().valid(2, 1), Joi.boolean()),
}).strict();
