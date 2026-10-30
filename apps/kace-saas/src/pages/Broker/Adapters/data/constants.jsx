import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_ADAPTERS = ["name", "created_at", "updated_at"];

export const dataTableConfig = {
    key: URL_AND_KEYS.broker_adapters.key,
    url: URL_AND_KEYS.broker_adapters.url,
    view: URL_AND_KEYS.broker_adapters.view,
    genericColumns: HEADERS_CONST_ADAPTERS,
    entity: URL_AND_KEYS.broker_adapters.entity,
};

export const FILTER_TRANSFORMATIONS = {
    name: (row) => ({
        ...row,
        label: "name",
        filterData: {
            field: `${URL_AND_KEYS.broker_adapters.view}.name`,
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
};

export const INITIAL_FORM = {
    id: "",
    name: "",
    host: "",
    port: 5672,
    queue: "",
    exchange: "",
    vhost: "",
    username: "",
    password: "",
};
