export const getAnsColumnOptions = (columns) => {
    if (!Array.isArray(columns)) return [];
    return columns
        .filter((column) => column?.is_ans && (column?.alias || column?.field))
        .map((column) => {
            const value = column.alias || column.field;
            return { label: value, value };
        });
};
