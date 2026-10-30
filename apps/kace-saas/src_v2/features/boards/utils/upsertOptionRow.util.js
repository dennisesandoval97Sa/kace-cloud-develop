export const isSameBoardOptionRow = (item, next) => item?.id != null && item.id === next?.id;

export const upsertOptionRow = (rows, values, isSameRow, createId) => {
    const index = rows.findIndex((item) => isSameRow(item, values));
    return index !== -1
        ? rows.map((row, i) => (i === index ? { ...values, id: row.id } : row))
        : [...rows, { ...values, id: createId() }];
};
