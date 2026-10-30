import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_CHANNEL_HUB = ["name", "email", "country_id", "channel_hub_connection_id", "created_at"];

const PLAIN_TEXT_ID_COLUMN_META = { renderAsPlainText: true };

export const dataTableConfig = {
    key: URL_AND_KEYS.channel_hub.key,
    url: URL_AND_KEYS.channel_hub.url,
    view: URL_AND_KEYS.channel_hub.view,
    genericColumns: HEADERS_CONST_CHANNEL_HUB,
    entity: URL_AND_KEYS.channel_hub.entity,
};

export const FILTER_TRANSFORMATIONS = {
    name: (row) => ({
        ...row,
        label: "name",
        filterData: {
            field: "channel_hub_accounts.name",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    email: (row) => ({
        ...row,
        label: "email",
        filterData: {
            field: "channel_hub_accounts.email",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    country_id: (row) => ({
        ...row,
        label: "country_id",
        meta: {
            ...row.meta,
            ...PLAIN_TEXT_ID_COLUMN_META,
        },
        filterData: {
            field: "channel_hub_accounts.country_id",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    channel_hub_connection_id: (row) => ({
        ...row,
        label: "channel_hub_connection_id",
        meta: {
            ...row.meta,
            ...PLAIN_TEXT_ID_COLUMN_META,
        },
    }),
};

export const INITIAL_FORM = {
    id: "",
    email: "",
    name: "",
    country_id: "",
    operator_id: "",
    rest_flow_id: "",
    mail_rule_list_rest_flow_id: "",
    mail_rule_priority_update_rest_flow_id: "",
};
