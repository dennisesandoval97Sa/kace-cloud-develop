import { handleState } from "@/utils/main";
import { handleStateTimer } from "@/utils/form-format";
import { FILTER_TRANSFORMATIONS } from "../data/constants";

export const processData = async (data) => {
    const normalizedData = data?.data ?? data ?? [];
    const processedData = handleStateTimer(handleState(normalizedData));

    return processedData.map((item) => ({
        ...item,
        secreto: "***",
    }));
};

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processFilters = (defaultFilters) => [...defaultFilters];
