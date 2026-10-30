export const getTableFiltersKey = (tableFilters) => JSON.stringify(tableFilters ?? []);

export const getSynchronizedBaseFilters = ({ urlFilter, tableFilters }) => urlFilter ?? tableFilters ?? [];
