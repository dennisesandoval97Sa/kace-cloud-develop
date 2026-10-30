import { handleState, handleStateTimer } from "../../../utils/main";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { dataTableConfig, FILTER_TRANSFORMATIONS } from "../data/constants";

export const processData = async (data) => {
    const normalizedData = data?.data ?? data;

    const flattenedData = normalizedData.map(item => ({
        ...item,
        expiredCases: item.expiredCases?.count ?? "0",
        intermediateCases: item.intermediateCases?.count ?? "0",
        notExpiredCases: item.notExpiredCases?.count ?? "0",
    }));

    return handleStateTimer(handleState(flattenedData));
};

export const processColumns = (defaultFilters) => {
    return {
        ...defaultFilters,
        ...FILTER_TRANSFORMATIONS,
    };
};

export const processFilters = (defaultFilters) => ([
    ...defaultFilters,
    {
        column_name: "status",
        field: SPECIAL_FIELDS.switch_state,
    },
]);

export const processSchema = (schema) => {

    const schemaFromServer = schema.filter((column) =>
        dataTableConfig.genericColumns.includes(column.column_name),
    );

    const descriptionColumnIndex = schemaFromServer.findIndex(
        (column) => column.column_name === "description",
    );

    if (descriptionColumnIndex !== -1) {
        const result = [
            ...schemaFromServer.slice(0, descriptionColumnIndex + 1),
            ...schemaFromServer.slice(descriptionColumnIndex + 1),
        ];
        return result;
    }

    return [...schemaFromServer];
};
