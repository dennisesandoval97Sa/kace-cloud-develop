import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";

export const HEADERS_CONSTANT_USERS = [
    "nombres",
    "apellido1",
    "email",
    "rol_nombre",
    "groups",
    "expiredCases",
    "intermediateCases",
    "notExpiredCases",
    "is_active",
    "updated_at",
    "created_at",
];

export const NEW_COLUMNS_USERS = [
    {
        column_name: "expiredCases",
        data_type: "String",
        character_maximum_length: 1,
        relation: null,
        label: "Expired Cases",
    },
    {
        column_name: "intermediateCases",
        data_type: "String",
        character_maximum_length: 1,
        relation: null,
        label: "Intermediate Cases",
    },
    {
        column_name: "notExpiredCases",
        data_type: "String",
        character_maximum_length: 1,
        relation: null,
        label: "Not Expired Cases",
    },
];

export const dataTableConfig = {
    key: URL_AND_KEYS.users.key,
    url: URL_AND_KEYS.users.url,
    view: URL_AND_KEYS.users.view,
    genericColumns: HEADERS_CONSTANT_USERS,
    entity: URL_AND_KEYS.users.entity,
};

export const FILTER_TRANSFORMATIONS = {
    nombres: (row) => ({
        ...row,
        label: "nombres",
        filterData: {
            field: "nombres",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    apellido1: (row) => ({
        ...row,
        filterData: {
            field: "apellido1",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    email: (row) => ({
        ...row,
        label: "email",
        filterData: {
            field: "email",
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
    rol_nombre: (row) => ({
        ...row,
        label: "rol",
        data_type: SPECIAL_FIELDS.multiselect_roles,
        enableSorting: false,
        filterData: {
            field: "rol_id",
            operator: "in",
            type: "AND",
            value: "",
        },
    }),
    groups: (row) => ({
        ...row,
        label: "grupos",
        data_type: SPECIAL_FIELDS.multiselect_groups,
        enableSorting: false,
        filterData: {
            field: "grupos_ids",
            operator: "in",
            type: "AND",
            value: "",
        },
    }),
};
