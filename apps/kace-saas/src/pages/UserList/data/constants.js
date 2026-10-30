import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_USER_LIST = [
    "descripcion",
    "created_at",
    "updated_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.userLists.key,
    url: URL_AND_KEYS.userLists.url,
    view: URL_AND_KEYS.userLists.view,
    genericColumns: HEADERS_CONST_USER_LIST,
    entity: URL_AND_KEYS.userLists.entity,
};

export const FILTER_TRANSFORMATIONS = {
    descripcion: (row) => ({
        ...row,
        label: "Descripcion",
        filterData: {
            field: "descripcion",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
};
