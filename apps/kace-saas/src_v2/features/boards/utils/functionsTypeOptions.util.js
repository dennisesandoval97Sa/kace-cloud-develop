import { SQL } from "@kace_v2/shared/constants/sql.constants";

export const aggregateFunctionsTypeOptions = () => {
    return Object.entries(SQL.AGGREGATE_FUNCTIONS).map(([label, value]) => ({
        label,
        value,
    }));
};

export const comparisonFunctionsTypeOptions = (t) => {
    // Mapeo de funciones de comparación a sus claves de traducción
    const comparisonFunctionLabels = {
        DATE_DIFFERENCE: t("boards.form.labels.dateDifference"),
    };

    return Object.entries(SQL.COMPARISON_FUNCTIONS).map(([key, value]) => ({
        label: comparisonFunctionLabels[key] || key,
        value,
    }));
};

export const functionTypeOptions = (t) => {
    return [
        { label: t("boards.form.functionTypes.aggregate"), value: SQL.FUNCTION_TYPES.AGGREGATE },
        { label: t("boards.form.functionTypes.comparison"), value: SQL.FUNCTION_TYPES.COMPARISON },
        { label: t("boards.form.functionTypes.concat"), value: SQL.FUNCTION_TYPES.CONCAT },
    ];
};

// Mantener compatibilidad hacia atrás
export const functionsTypeOptions = aggregateFunctionsTypeOptions;
export const groupingFunctionsTypeOptions = aggregateFunctionsTypeOptions;
