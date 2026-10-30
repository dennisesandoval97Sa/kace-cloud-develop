import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const INITIAL_VALUES_DEFINITIONS = {
    id: "",
    schema_id: "",
    restflow_id: "",
    name: "",
    is_active: true,
    tablename: "",
    logs_tablename: "",
};

export const definitionsDataTableConfig = {
    url: URL_AND_KEYS.auxDefinitions.url,
    key: URL_AND_KEYS.actions.key,
    view: URL_AND_KEYS.auxDefinitions.view,
    genericColumns: ["name", "schema_id", "is_active", "created_at", "updated_at" ],
    entity: URL_AND_KEYS.auxDefinitions.entity,
};

export const FILTER_TRANSFORMATIONS = {
    name: (row) => ({
        ...row,
        label: "Name",
        filterData: {
            field: "name",
            operator: "ilike",
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
    created_at: (row) => ({
        ...row,
        label: "Created at",
        filterData: {
            field: "created_at",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
};
