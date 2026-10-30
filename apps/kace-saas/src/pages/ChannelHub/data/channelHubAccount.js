import Joi from "joi";

const ACCOUNT_FIELDS = [
    "id",
    "email",
    "name",
    "country_id",
    "operator_id",
    "rest_flow_id",
    "mail_rule_list_rest_flow_id",
    "mail_rule_priority_update_rest_flow_id",
    "channel_hub_connection_id",
];

const accountFieldSchema = Joi.alternatives().try(
    Joi.string().allow(""),
    Joi.object({ value: Joi.string().allow("").required() }).unknown(true),
    Joi.valid(null),
);

const accountSchema = Joi.object(
    Object.fromEntries(ACCOUNT_FIELDS.map((field) => [field, accountFieldSchema.optional()])),
).unknown(true);

const accountFieldValue = (field) => field?.value ?? field ?? "";

export const parseChannelHubAccount = (payload) => {
    const account = payload?.data ?? payload;
    const { value, error } = accountSchema.validate(account ?? {}, { stripUnknown: false });
    if (error) return {};

    return Object.fromEntries(ACCOUNT_FIELDS.map((field) => [field, accountFieldValue(value[field])]));
};
