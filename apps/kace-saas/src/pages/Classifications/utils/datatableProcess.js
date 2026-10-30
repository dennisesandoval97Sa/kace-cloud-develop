import { handleState, handleStateTimer } from "../../../utils/main";
import { SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import { FILTER_TRANSFORMATIONS } from "../data/constants";
import { handlePrincipalFlow, createChildren } from "@/utils/src/utils/FormatData";

const DESCRIPTION_FILTER = {
    column_name: "description",
    field: SPECIAL_FIELDS.select_classification,
    data_type: SPECIAL_FIELDS.select_classification,
    inject: true,
    fullWidth: true,
    label: "Description",
    filterData: {
        field: "clasificaciones.id",
        operator: "eq",
        type: "AND",
        value: "",
    },
};

export const processData = async (data) => {
    const normalizedData = data?.data ?? data;
    return handleStateTimer(handlePrincipalFlow(createChildren(handleState(normalizedData))));
};

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processFilters = (can_start_sub_cases_flow) => {
    const includeFilters = [
        {
            column_name: "is_active",
            field: SPECIAL_FIELDS.switch_state,
        },
        {
            column_name: "nivel1",
            field: SPECIAL_FIELDS.classification_levels,
        },
        DESCRIPTION_FILTER,
    ];

    if (can_start_sub_cases_flow) {
        includeFilters.push({
            column_name: "can_start_sub_cases_flow",
            field: SPECIAL_FIELDS.switch_state,
        });
    }

    return (defaultFilters) => [...defaultFilters, ...includeFilters];
};
