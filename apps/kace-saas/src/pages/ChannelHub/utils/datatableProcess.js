import { FILTER_TRANSFORMATIONS } from "../data/constants";

export const processData = async (data) => {
    const normalizedData = data?.data ?? data;
    return normalizedData;
};

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processFilters = (defaultFilters) => [...defaultFilters];
