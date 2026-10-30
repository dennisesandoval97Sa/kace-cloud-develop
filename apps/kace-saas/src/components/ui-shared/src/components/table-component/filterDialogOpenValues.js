export const buildEmptyFilterFormValues = (columnNames = []) =>
    Object.fromEntries(columnNames.map((columnName) => [columnName, ""]));

export const getFilterDialogOpenValues = (appliedValues = {}, columnNames = []) => {
    const emptyValues = buildEmptyFilterFormValues(columnNames);
    const hasApplied = Object.values(appliedValues).some((v) => v !== "" && v !== null && v !== undefined);
    return hasApplied ? { ...emptyValues, ...appliedValues } : emptyValues;
};
