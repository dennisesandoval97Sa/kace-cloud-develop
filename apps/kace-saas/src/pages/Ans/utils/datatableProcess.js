import { handleState, handleStateTimer } from "../../../utils/main";
import { SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import { FILTER_TRANSFORMATIONS } from "../data/constants";

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
        column_name: "color_ans_inicial",
        field: SPECIAL_FIELDS.select_colors,
    },
    {
        column_name: "color_ans_intermedio",
        field: SPECIAL_FIELDS.select_colors,
    },
    {
        column_name: "color_ans_final",
        field: SPECIAL_FIELDS.select_colors,
    },
    {
        column_name: "status",
        field: SPECIAL_FIELDS.switch_state,
    },
];
