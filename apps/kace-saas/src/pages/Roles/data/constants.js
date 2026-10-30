import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HANDLE_CONST_ROLES = ["descripcion", "status", "created_at", "updated_at"];

export const dataTableConfig = {
    key: URL_AND_KEYS.roles.key,
    url: URL_AND_KEYS.roles.url,
    view: URL_AND_KEYS.roles.view,
    genericColumns: HANDLE_CONST_ROLES,
    entity: URL_AND_KEYS.roles.entity,
};

export const FILTER_TRANSFORMATIONS = {
    descripcion: (row) => ({
        ...row,
        label: "descripcion",
        filterData: {
            field: "descripcion",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    status: (row) => ({
        ...row,
        column_name: "status",
        filterData: {
            field: "status",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
