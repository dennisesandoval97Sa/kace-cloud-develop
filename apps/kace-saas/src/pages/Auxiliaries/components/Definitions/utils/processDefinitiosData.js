import { handleState, handleStateTimer } from "@/utils/main";
import { FILTER_TRANSFORMATIONS } from "../constants";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";

export const processData = (data) => {
    const normalizedData = data?.data ?? data;
    return handleStateTimer(handleState(normalizedData));
};

export const processDefinitionsColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processDefinitionsFilters = (defaultFilters) => [
    ...defaultFilters,
    {
        column_name: "name",
        field: SPECIAL_FIELDS.string,
    },
    {
        column_name: "is_active",
        field: SPECIAL_FIELDS.switch_state,
    },
];
