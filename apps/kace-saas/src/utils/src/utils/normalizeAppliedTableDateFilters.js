import { normalizeTableDateRangeFilter } from "./normalizeTableDateRangeFilter";

const isDateLikeType = (dataType) => dataType === "date" || dataType === "datetime";

export const normalizeAppliedTableDateFilters = (filtersMap = {}, schema = [], timeZone) => {
    const schemaByColumn = new Map(schema.map((field) => [field.column_name, field]));

    return Object.fromEntries(
        Object.entries(filtersMap).flatMap(([key, descriptor]) => {
            if (!descriptor || typeof descriptor !== "object") return [[key, descriptor]];

            const dataType = schemaByColumn.get(key)?.data_type;
            if (!isDateLikeType(dataType)) return [[key, descriptor]];

            const mode = dataType === "datetime" ? "datetime" : "date";
            const normalized = normalizeTableDateRangeFilter(descriptor.value, timeZone, { mode });

            return normalized === null ? [] : [[key, { ...descriptor, value: normalized }]];
        }),
    );
};
