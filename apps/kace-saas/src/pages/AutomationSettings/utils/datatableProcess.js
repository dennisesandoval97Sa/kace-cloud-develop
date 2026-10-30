import { handleStateTimer } from "@/utils/main";
import { FILTER_TRANSFORMATIONS } from "../data/constants";

export const processData = async (data) => handleStateTimer(data?.data ?? data);

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});
