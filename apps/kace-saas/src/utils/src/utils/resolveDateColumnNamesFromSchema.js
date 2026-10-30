const DATE_TYPES = new Set([
    "date",
    "datetime",
    "timestamp",
    "timestamptz",
    "timestamp without time zone",
    "timestamp with time zone",
]);

const normalizeColumnType = (column) => (column.schema_column_type ?? column.data_type ?? "").toString().toLowerCase();

export const isDateColumnType = (dataType) => DATE_TYPES.has((dataType ?? "").toString().toLowerCase());

export const resolveDateColumnNamesFromSchema = (schema = []) => {
    if (!Array.isArray(schema)) {
        return [];
    }

    return schema.filter((column) => DATE_TYPES.has(normalizeColumnType(column))).map((column) => column.column_name);
};
