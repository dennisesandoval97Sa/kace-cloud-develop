import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_CLIENT_NOTIFICATIONS = [
    "subject",
    "message",
    "is_active",
    "start_date",
    "end_date",
    "updated_at",
    "created_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.clientNotifications.key,
    url: URL_AND_KEYS.clientNotifications.url,
    view: URL_AND_KEYS.clientNotifications.view,
    genericColumns: HEADERS_CONST_CLIENT_NOTIFICATIONS,
    entity: URL_AND_KEYS.clientNotifications.entity,
};

export const FILTER_TRANSFORMATIONS = {
    subject: (row) => ({
        ...row,
        column_name: "subject",
        filterData: {
            field: "subject",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    message: (row) => ({
        ...row,
        column_name: "message",
        filterData: {
            field: "message",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    start_date: (row) => ({
        ...row,
        column_name: "start_date",
        filterData: {
            field: "start_date",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
    end_date: (row) => ({
        ...row,
        column_name: "end_date",
        filterData: {
            field: "end_date",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        column_name: "is_active",
        filterData: {
            field: "is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
