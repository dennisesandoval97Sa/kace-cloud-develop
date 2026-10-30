import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_USER_NOTIFICATIONS = [
    "asunto",
    "mensaje",
    "is_active",
    "fecha_inicio",
    "fecha_fin",
    "updated_at",
    "created_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.userNotifications.key,
    url: URL_AND_KEYS.userNotifications.url,
    view: URL_AND_KEYS.userNotifications.view,
    genericColumns: HEADERS_CONST_USER_NOTIFICATIONS,
    entity: URL_AND_KEYS.userNotifications.entity,
};

export const FILTER_TRANSFORMATIONS = {
    asunto: (row) => ({
        ...row,
        column_name: "asunto",
        filterData: {
            field: "asunto",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    mensaje: (row) => ({
        ...row,
        column_name: "mensaje",
        filterData: {
            field: "mensaje",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    fecha_inicio: (row) => ({
        ...row,
        column_name: "fecha_inicio",
        filterData: {
            field: "fecha_inicio",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
    fecha_fin: (row) => ({
        ...row,
        column_name: "fecha_fin",
        filterData: {
            field: "fecha_fin",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        field_type: "boolean",
        filterData: {
            field: "is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
