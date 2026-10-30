import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const SHOW_COLUMNS = ["name"];

export const INITIAL_VALUES_AUX_SCHEMAS = {
    id: "",
    name: "",
    is_active: 1,
    fields: [],
};

const defaultSchemaFieldUi = () => ({
    label: "",
    css: "",
    input_type: "text",
    is_visible: true,
    read_only: false,
    show_in_grid: false,
    ui_modified: false,
});

export const INITIAL_SCHEMA_FIELD_VALUES = {
    string: {
        empty: true,
        alphanum: false,
        isoDate: false,
        base64: false,
        dataUri: false,
        trim: false,
        transform: false,
        lowercase: false,
        uppercase: false,
        min: null,
        max: null,
        length: null,
        ip: {
            cidr: "optional",
            version: ["ipv4", "ipv6"],
        },
        email: {
            minDomainSegments: 2,
            tlds: {
                allow: "com",
            },
        },
        uri: {
            scheme: ["http", "https"],
            allowRelative: false,
        },
        pattern: {
            regex: "",
            flags: "i",
        },
        regexReplace: [],
        valid: "",
        invalid: "",
        default: "",
        restflow_id: null,
        validationType: null,
        ui: defaultSchemaFieldUi(),
    },
    number: {
        min: null,
        max: null,
        greater: null,
        less: null,
        precision: null,
        multiple: null,
        default: null,
        integer: false,
        positive: false,
        negative: true,
        unsafe: false,
        port: false,
        valid: "",
        invalid: "",
        restflow_id: null,
        ui: defaultSchemaFieldUi(),
    },
    date: {
        timestamp: "javascript",
        iso: false,
        empty: false,
        timezoneFormat: "withoutTimezone",
        timezone: "",
        default: null,
        min: null,
        max: null,
        restflow_id: null,
        ui: defaultSchemaFieldUi(),
    },
};

export const dataTableConfig = {
    url: URL_AND_KEYS.schemas.url,
    key: URL_AND_KEYS.schemas.key,
    view: URL_AND_KEYS.schemas.view,
    genericColumns: ["name", "is_active", "created_at", "updated_at"],
    entity: URL_AND_KEYS.schemas.entity,
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
};

export const columnFilters = [
    {
        column_name: "name",
        field: SPECIAL_FIELDS.string,
    },
    {
        column_name: "is_active",
        field: SPECIAL_FIELDS.switch_state,
    },
];

export const dataTypeOptions = [
    { value: "string", label: "String", name: "String" },
    { value: "number", label: "Number", name: "Number" },
    { value: "boolean", label: "Boolean", name: "Boolean" },
    { value: "date", label: "Date", name: "Date" },
    { value: "array", label: "Array", name: "Array" },
    { value: "object", label: "Object", name: "Object" },
    { value: "calculated", label: "Calculated", name: "Calculated" },
];

export const getSchemasStringDataTypeOptions = (t) => [
    { value: "-", label: t("auxSchema.form.none") },
    { value: "email", label: t("auxSchema.form.email") },
    { value: "ip", label: t("auxSchema.form.ip") },
    { value: "uri", label: t("auxSchema.form.url") },
    { value: "pattern", label: t("auxSchema.form.pattern") },
];

export const getIpCidrOptions = (t) => [
    { value: "optional", label: t("auxSchema.form.optional") },
    { value: "required", label: t("auxSchema.form.required") },
    { value: "forbidden", label: t("auxSchema.form.forbidden") },
];
