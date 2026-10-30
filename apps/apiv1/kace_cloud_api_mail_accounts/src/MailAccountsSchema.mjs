import Joi from 'joi';
import { Protocols } from '@kace/core/src/mail-accounts/domain/Protocols';
import { Encryptions } from '@kace/core/src/mail-accounts/domain/Encryptions';
import { MailAccountsTypes } from '@kace/core/src/shared/domain/enum/MailAccountsTypes';

const sharedFields = {
    description: Joi.string().min(3).max(120),
    type: Joi.string().valid(...Object.values(MailAccountsTypes.toJson())),
    host: Joi.when('type', {
        is: 'smtp',
        then: Joi.string().max(255).required(),
        otherwise: Joi.string().max(255).allow(null),
    }),
    port: Joi.when('type', {
        is: 'smtp',
        then: Joi.number().integer().required(),
        otherwise: Joi.number().integer().allow(null),
    }),
    protocol: Joi.when('type', {
        is: 'smtp',
        then: Joi.string()
            .valid(...Object.values(Protocols.toJson()))
            .required(),
        otherwise: Joi.string()
            .valid(...Object.values(Protocols.toJson()))
            .allow(null),
    }),
    encryption: Joi.string()
        .valid(...Object.values(Encryptions.toJson()))
        .allow(null),
    username: Joi.when('type', {
        is: 'smtp',
        then: Joi.string().max(255).required(),
        otherwise: Joi.string().max(255).allow(null),
    }),
    password: Joi.when('type', {
        is: 'smtp',
        then: Joi.string().max(1000).required(),
        otherwise: Joi.string().max(1000).allow(null),
    }),
    from_address: Joi.string().max(1500).allow(null),
    from_name: Joi.string().max(250).allow(null),
    tenant_id: Joi.when('type', {
        is: Joi.valid(MailAccountsTypes.MS_GRAPH_APPLICATION.value, MailAccountsTypes.MS_GRAPH_USER.value),
        then: Joi.string().max(1000).required(),
        otherwise: Joi.string().max(1000).allow(null),
    }),
    client_id: Joi.when('type', {
        is: Joi.exist(),
        then: Joi.when('type', {
            is: Joi.not(MailAccountsTypes.SMTP.value),
            then: Joi.string().max(1000).required(),
            otherwise: Joi.string().max(1000).allow(null),
        }),
        otherwise: Joi.optional(),
    }),
    client_secret: Joi.when('type', {
        is: Joi.exist(),
        then: Joi.when('type', {
            is: Joi.not(MailAccountsTypes.SMTP.value),
            then: Joi.string().max(1000).required(),
            otherwise: Joi.string().max(1000).allow(null),
        }),
        otherwise: Joi.optional(),
    }),
    code: Joi.string().max(1000).allow(null),
    refresh_token: Joi.string().allow(null),
    mails_download_limit: Joi.number().integer().allow(null),
    login_endpoint: Joi.string().max(255).allow(null),
    graph_scope: Joi.string().max(255).allow(null),
    start_syncing_from: Joi.date().iso().allow(null),
    last_synchronization: Joi.date().iso().allow(null),
    folders: Joi.array().allow(null),
    access_token: Joi.string().allow(null),
    email_account: Joi.string().max(1500).allow(null),
    vault: Joi.boolean().allow(null),
    vault_data: Joi.object().allow(null),
    is_active: Joi.alternatives()
        .try(Joi.number().valid(2, 1), Joi.boolean())
        .custom((value) => {
            if (typeof value === 'boolean') return value ? 1 : 2;
            return value;
        }),
    register_in_channel_hub: Joi.boolean(),
    channel_hub_connection_id: Joi.string().allow(null).default(null),
    channel_hub_error: Joi.object().allow(null).default(null),
};

export const MailAccountsCreateSchema = Joi.object({
    ...sharedFields,
    id: Joi.string().uuid().required(),
    type: sharedFields.type.required(),
    description: sharedFields.description.required(),
    register_in_channel_hub: sharedFields.register_in_channel_hub.default(false),
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const MailAccountsUpdateSchema = Joi.object({
    ...sharedFields,
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional(),
});
