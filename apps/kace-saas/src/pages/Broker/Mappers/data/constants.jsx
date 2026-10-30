import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_MAPPERS = ["name", "created_at", "updated_at"];

export const dataTableConfig = {
    key: URL_AND_KEYS.broker_mappers.key,
    url: URL_AND_KEYS.broker_mappers.url,
    view: URL_AND_KEYS.broker_mappers.view,
    genericColumns: HEADERS_CONST_MAPPERS,
    entity: URL_AND_KEYS.broker_mappers.entity,
};

export const FILTER_TRANSFORMATIONS = {
    name: (row) => ({
        ...row,
        label: "name",
        filterData: {
            field: `${URL_AND_KEYS.broker_mappers.view}.name`,
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
};

export const INITIAL_FORM = {
    id: "",
    name: "",
    queue: "",
    rest_flow_id: "",
    rules: [],
};
