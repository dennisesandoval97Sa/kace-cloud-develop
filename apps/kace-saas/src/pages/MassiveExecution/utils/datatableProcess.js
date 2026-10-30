import { handleState, handleStateTimer } from "../../../utils/main";
import { FILTER_TRANSFORMATIONS } from "../data/constants";

export const processData = async (data) => {
    const normalizedData = data?.data ?? data;
    return handleStateTimer(handleState(normalizedData), ["start_at", "end_at"]);
};

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processFilters = (defaultFilters) => [...defaultFilters];
