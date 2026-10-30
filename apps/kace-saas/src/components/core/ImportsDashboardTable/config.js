import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { handleStateTimer } from "@/utils/main";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_IMPORT_FILE = [
    "file_path",
    "status",
    "upload_attempts",
    "total_records",
    "processed_records",
    "last_updated_at",
    "created_at",
    "error_details",
];

export const FILTER_COLUMNS_IMPORT_FILE = [
    "file_path",
    "status",
    "upload_attempts",
    "total_records",
    "processed_records",
    "last_updated_at",
    "created_at",
];

// Literales que escribe el backend en s3_import_files.status (S3ImportsProcessor / CsvRecordProcessorService).
export const IMPORT_STATUS_VALUES_LIST = ["pending", "processing", "completed", "incompleted", "rejected", "failed"];

export const getImportStatusFilterOptions = (t) =>
    IMPORT_STATUS_VALUES_LIST.map((status) => ({
        value: status,
        name: t(`importExport.form.statuses.${status}`, { defaultValue: status }),
    }));

export const dataTableConfigImportFile = {
    key: URL_AND_KEYS.importsDashboard.key,
    url: URL_AND_KEYS.importsDashboard.url,
    view: URL_AND_KEYS.importsDashboard.view,
    entity: URL_AND_KEYS.importsDashboard.entity,
    genericColumns: HEADERS_CONSTANT_IMPORT_FILE,
    filterColumns: FILTER_COLUMNS_IMPORT_FILE,
};

const createFilterTransformation = (columnName, { operator = "eq", label, ...rest } = {}) => {
    return (row) => ({
        ...row,
        ...(label && { label }),
        ...rest,
        filterData: {
            field: `${URL_AND_KEYS.importsDashboard.view}.${columnName}`,
            operator,
            type: "AND",
            value: "",
        },
    });
};

/*
 * El catálogo de /schema-fields devuelve label "undefined" para casi todas estas columnas, por eso se fija
 * aquí el label que ya tiene traducción en gridMain.columns.
 */
export const createImportFileFilterTransformations = (t) => ({
    file_path: createFilterTransformation("file_path", { operator: "ilike", label: "File Path" }),
    status: createFilterTransformation("status", {
        label: "Status",
        data_type: SPECIAL_FIELDS.list,
        options: getImportStatusFilterOptions(t),
    }),
    upload_attempts: createFilterTransformation("upload_attempts", { label: "Upload Attempts" }),
    total_records: createFilterTransformation("total_records", { label: "Total Records" }),
    processed_records: createFilterTransformation("processed_records", { label: "Processed Records" }),
    last_updated_at: createFilterTransformation("last_updated_at", {
        operator: "between",
        label: "Last Updated",
    }),
    created_at: createFilterTransformation("created_at", { operator: "between", label: "Created at" }),
    error_details: (row) => ({ ...row, label: "Error Details" }),
});

export const createProcessColumns = (t) => {
    const transformations = createImportFileFilterTransformations(t);
    return (defaultFilters) => ({
        ...defaultFilters,
        ...transformations,
    });
};

// Sin handleState: aquí status es el estado de la importación, no un booleano activo/inactivo.
export const processData = (data) => handleStateTimer(data, ["last_updated_at"]);

export const processFilters = (defaultFilters) => [
    ...defaultFilters,
    {
        column_name: "status",
        field: SPECIAL_FIELDS.list,
    },
];
