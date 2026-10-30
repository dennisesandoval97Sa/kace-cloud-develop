import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

export const HEADERS_CONSTANT_UPDATE_MODEL = [
    { column_name: "description", label: "Description", data_type: "string" },
    { column_name: "aggregate", label: "Aggregate", data_type: "string" },
    { column_name: "field", label: "Field", data_type: "string" },
    { column_name: "type", label: "Type", data_type: "string" },
    { column_name: "formula", label: "Formula", data_type: "string" },
    { column_name: "value", label: "Value", data_type: "string" },
];

export const INITIAL_VALUES_UPDATE_MODE = {
    description: "",
    aggregate: "",
    field: "",
    type: "",
    formula: "",
    value: "",
    aggregate_aux: "",
    field_aux: "",
};

export const agregateOptions = [
    {
        label: "CLIENTES",
        value: "Client",
        dataOrigin: "clients",
    },
    {
        label: "CASOS",
        value: "Case",
        dataOrigin: "cases",
    },
    {
        label: "AUX_CASE",
        value: "AuxCases",
        dataOrigin: "aux_cases",
    },
    {
        label: "AUX_CLIENT",
        value: "AuxClient",
        dataOrigin: "aux_clients",
    },
];

export const allowedKeysData = [
    "alto_impacto",
    "fecha_resolucion",
    "grupo_id",
    "motivo_baja",
    "responsable_id",
    "transicion_id",
    "nombres",
    "apellido1",
    "apellido2",
    "nombre_empresa",
    "sexo",
    "estado_civil",
    "fecha_nacimiento",
    "email",
    "email_alterno",
    "telefono",
    "telefono_alterno",
    "campos_extra1",
    "campos_extra2",
    "campos_extra3",
    "status",
    "padre_id",
    "habeas_data",
    "created_by",
    "external_code",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.actionModelUpdate.key,
    url: URL_AND_KEYS.actionModelUpdate.url,
    view: URL_AND_KEYS.actionModelUpdate.view,
    genericColumns: [...HEADERS_CONSTANT_UPDATE_MODEL.map((field) => field.column_name), "created_at", "updated_at"],
    entity: URL_AND_KEYS.actionModelUpdate.entity,
};

export const FILTER_TRANSFORMATIONS = {
    description: (row) => ({
        ...row,
        label: "Description",
        filterData: {
            field: "action_model_updates.description",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    aggregate: (row) => ({
        ...row,
        label: "Aggregate",
        filterData: {
            field: "action_model_updates.aggregate",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    field: (row) => ({
        ...row,
        label: "Field",
        filterData: {
            field: "action_model_updates.field",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    type: (row) => ({
        ...row,
        label: "Type",
        filterData: {
            field: "action_model_updates.type",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    formula: (row) => ({
        ...row,
        label: "Formula",
        filterData: {
            field: "action_model_updates.formula",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    value: (row) => ({
        ...row,
        label: "Value",
        filterData: {
            field: "action_model_updates.value",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    created_at: (row) => ({
        ...row,
        label: "Created at",
        filterData: {
            field: "action_model_updates.created_at",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
};
