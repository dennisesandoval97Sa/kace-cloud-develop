import { handleState, handleStateTimer } from "@/utils/main";
import { COLUMN_FILTERS, FILTER_INJECTED_FIELDS, FILTER_TRANSFORMATIONS } from "../data/ConstantsOneScript";

export const processData = async (data) => {
    const normalized = data?.data ?? data;
    return handleStateTimer(handleState(normalized));
};

export const processColumns = (defaultFilters) => ({ ...defaultFilters, ...FILTER_TRANSFORMATIONS });

export const processFilters = (defaultFilters) => [...defaultFilters, ...COLUMN_FILTERS, ...FILTER_INJECTED_FIELDS];
