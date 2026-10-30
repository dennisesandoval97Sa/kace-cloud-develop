import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";

export const HEADERS_CONST_ONE_SCRIPT = ["name", "url", "created_at", "updated_at"];

export const INITIAL_VALUES_ONE_SCRIPT = {
    name: "",
    url: "",
    url_api: "",
    schema_id: null,
    onescript_reference_id: "",
};

export const dataTableConfig = {
    key: URL_AND_KEYS.oneScript.key,
    url: URL_AND_KEYS.oneScript.url,
    view: URL_AND_KEYS.oneScript.view,
    entity: URL_AND_KEYS.oneScript.entity,
    genericColumns: HEADERS_CONST_ONE_SCRIPT,
};

export const COLUMN_FILTERS = [
    {
        column_name: "name",
        field: SPECIAL_FIELDS.string,
    },
];

export const FILTER_INJECTED_FIELDS = [
    {
        column_name: "id",
        field: SPECIAL_FIELDS.string,
        data_type: SPECIAL_FIELDS.string,
        inject: true,
        label: "ID",
        filterData: {
            field: "id",
            operator: "eq",
            type: "AND",
            value: "",
        },
    },
    {
        column_name: "onescript_reference_id",
        field: SPECIAL_FIELDS.string,
        data_type: SPECIAL_FIELDS.string,
        inject: true,
        label: "OneScript Form ID",
        filterData: {
            field: "onescript_reference_id",
            operator: "eq",
            type: "AND",
            value: "",
        },
    },
    {
        column_name: "schema_id",
        field: SPECIAL_FIELDS.schema_id,
        data_type: SPECIAL_FIELDS.schema_id,
        inject: true,
        label: "Schema ID",
        filterData: {
            field: "schema_id",
            operator: "eq",
            type: "AND",
            value: "",
        },
    },
];

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
};
