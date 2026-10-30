import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_MAIL_ACCOUNT = [
    "description",
    "type",
    "host",
    "port",
    "protocol",
    "is_active",
    "created_at",
    "updated_at",
];

export const MAIL_ACCOUNT_FILTER_COLUMNS = [
    "description",
    "type",
    "host",
    "port",
    "protocol",
    "is_active",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.mail_accounts.key,
    url: URL_AND_KEYS.mail_accounts.url,
    view: URL_AND_KEYS.mail_accounts.view,
    entity: URL_AND_KEYS.mail_accounts.entity,
    genericColumns: HEADERS_CONST_MAIL_ACCOUNT,
    filterColumns: MAIL_ACCOUNT_FILTER_COLUMNS,
};

const createFilterTransformation = (field, operator = "ilike") => {
    return (row) => ({
        ...row,
        filterData: {
            field: `${URL_AND_KEYS.mail_accounts.view}.${field}`,
            operator,
            type: "AND",
            value: "",
        },
    });
};

export const FILTER_TRANSFORMATIONS = {
    description: createFilterTransformation("description"),
    type: createFilterTransformation("type"),
    host: createFilterTransformation("host"),
    port: createFilterTransformation("port", "eq"),
    protocol: createFilterTransformation("protocol"),
    is_active: createFilterTransformation("is_active", "eq"),
    created_by: createFilterTransformation("created_by", "eq"),
    updated_by: createFilterTransformation("updated_by", "eq"),
};
