import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { FILTER_TRANSFORMATIONS } from "../constants";
import { createChildren, handleASeniority, handleFullName, handleState, handleStateTimer } from "@/utils/main";
import { applyTimeDescriptionDisplay } from "@/utils/src/utils/timeDescriptionPrefix";

export const processSubcasesColumns = (filters = {}, schema) => {
    return {
        ...filters,
        ...FILTER_TRANSFORMATIONS,
    };
};

export const processSubcasesFilters = (defaultFilters) => [
    ...defaultFilters,
    {
        column_name: "nivel1",
        field: SPECIAL_FIELDS.classification_levels,
    },
];

export const processSubcasesData = (
    due_date_for_ans_calculation = false,
    semaphore_by_state_ans = false,
    show_time_description_prefixes = true,
) => {
    return (data) => {
        try {
            const transformedData =
                handleStateTimer(
                    handleASeniority(
                        handleFullName(
                            createChildren(handleState(data)),
                            "allCases",
                            due_date_for_ans_calculation,
                            semaphore_by_state_ans,
                        ),
                        show_time_description_prefixes,
                    ),
                ) || [];
            return transformedData.map((item) => applyTimeDescriptionDisplay(item, show_time_description_prefixes));
        } catch {
            return [];
        }
    };
};

export const headersTransform = (column) => {
    const labelMap = {
        nombres: "Responsible",
        nombre_cliente: "Customer",
        reference: "Consecutivo",
        estadoactual: "Current state",
        nombrecliente: "First names",
        primerapellido: "First surname",
        segundoapellido: "Second surname",
    };

    if (labelMap[column.column_name]) column.label = labelMap[column.column_name];

    return column;
};
