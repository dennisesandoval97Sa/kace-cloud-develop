import { SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import { handleState, handleStateTimer } from "../../../utils/main";
import { FILTER_TRANSFORMATIONS } from "../data/Constants";

export const processData = async (data) => {
    const normalizedData = data?.data ?? data;
    return handleStateTimer(handleState(normalizedData));
};

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processFilters = (defaultFilters) => [
    ...defaultFilters,
    {
        column_name: "color",
        field: SPECIAL_FIELDS.select_colors,
    },
    {
        column_name: "is_active",
        field: SPECIAL_FIELDS.switch_state,
    },
];
