import { handleState, handleStateTimer } from "@/utils/main";
import { columnFilters, FILTER_TRANSFORMATIONS } from "../data/constants";

export const processFilters = (defaultFilters) => ([
    ...defaultFilters,
    ...columnFilters,
]);

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processData = (data) => {
    const normalizedData = data?.data ?? data;
    return handleStateTimer(handleState(normalizedData));
};
