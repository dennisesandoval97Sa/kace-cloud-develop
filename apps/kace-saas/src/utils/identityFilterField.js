const AUDIT_FK_COLUMNS = new Set(["created_by", "updated_by", "edited_by", "deleted_by"]);

const columnName = (field) => {
    if (typeof field !== "string" || field.length === 0) return "";
    const segments = field.split(".");
    return segments[segments.length - 1];
};

export const isIdentityFilterField = (field) => {
    const column = columnName(field);
    if (!column) return false;
    return column === "id" || column.endsWith("_id") || AUDIT_FK_COLUMNS.has(column);
};

export const identityFilterOperator = (field) => (isIdentityFilterField(field) ? "eq" : null);
