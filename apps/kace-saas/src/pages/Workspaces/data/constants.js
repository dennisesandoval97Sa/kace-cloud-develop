import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_WORKSPACES = ["description", "tag", "is_active", "created_at", "updated_at"];

export const dataTableConfig = {
    key: URL_AND_KEYS.workspaces.key,
    url: URL_AND_KEYS.workspaces.url,
    view: URL_AND_KEYS.workspaces.view,
    genericColumns: HEADERS_CONST_WORKSPACES,
    entity: URL_AND_KEYS.workspaces.entity,
};

export const FILTER_TRANSFORMATIONS = {
    description: (row) => ({
        ...row,
        label: "description",
        filterData: {
            field: "description",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        filterData: {
            field: "is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};

export const fieldOptions = [
    { value: "subject", labelKey: "workspace.rules.fields.subject" },
    { value: "cc", labelKey: "workspace.rules.fields.cc" },
    { value: "from", labelKey: "workspace.rules.fields.from" },
    { value: "to", labelKey: "workspace.rules.fields.to" },
    { value: "body", labelKey: "workspace.rules.fields.body" },
];

export const operatorOptions = [
    { value: "contains", labelKey: "workspace.rules.operators.contains" },
    { value: "equals", labelKey: "workspace.rules.operators.equals" },
];
