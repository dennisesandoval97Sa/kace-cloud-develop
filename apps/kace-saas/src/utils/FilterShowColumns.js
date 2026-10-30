export const filterShowColumns = (columnData, columnShow) => {
    return columnShow
        .map((name) => columnData.find((column) => column.column_name === name))
        .filter(Boolean);
};

export const filterColumnsByShow = (columnData, columnShow) => {
    return columnData.filter((column) => {
        return columnShow.some((col) => col.column_name === column.column_name);
    });
};
