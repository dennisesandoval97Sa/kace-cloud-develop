import { SQL } from "@kace_v2/shared/constants/sql.constants";
import { BOARDS_INITIAL_FILTER } from "@kace_v2/features/boards/constants/boards.constants";

export const isBoardIdentityFunction = (functionType) =>
    functionType === BOARDS_INITIAL_FILTER.LOGGED_IN_USER ||
    functionType === BOARDS_INITIAL_FILTER.LOGGED_IN_USER_GROUP ||
    functionType === BOARDS_INITIAL_FILTER.ACTIVE_CLIENT;

export const isNumericType = (dataType) => {
    if (!dataType) return false;
    const normalized = String(dataType).toUpperCase();
    return normalized === "NUMBER" || normalized === "NUMERIC";
};

export const isDateType = (dataType) => {
    if (!dataType) return false;
    const normalized = String(dataType).toUpperCase();
    return normalized === "DATE";
};

export const extractBaseExpression = (expression) => {
    if (!expression) return "";
    // [funcion(columna), funcion, columna]
    const match = expression.match(/^(count|sum|avg|max|min)\((.+)\)$/);
    if (match) {
        return match[2];
    }
    return expression;
};

/**
 * Verify if a SQL function requires filtering numeric fields
 * @param {string} functionValue - Function name (sum, avg, count, etc)
 * @returns {boolean} - true if it requires filtering numeric fields
 */
export const shouldFilterNumeric = (functionValue) => {
    if (!functionValue) return false;
    const normalized = String(functionValue).toLowerCase();
    return normalized === "sum" || normalized === "avg";
};

/**
 * Verify if a SQL function is a comparison function
 * @param {string} functionValue - Function name
 * @returns {boolean} - true if it is a comparison function
 */
export const isComparisonFunction = (functionValue) => {
    if (!functionValue) return false;
    const normalized = String(functionValue).toLowerCase();
    return normalized === SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE.toLowerCase();
};

/**
 * Verify if a SQL function is an aggregate function
 * @param {string} functionValue - Function name
 * @returns {boolean} - true if it is an aggregate function
 */
export const isAggregateFunction = (functionValue) => {
    if (!functionValue) return false;
    const normalized = String(functionValue).toLowerCase();
    return Object.values(SQL.AGGREGATE_FUNCTIONS)
        .map((f) => f.toLowerCase())
        .includes(normalized);
};

// Mantener compatibilidad hacia atrás
export const isGroupingFunction = isAggregateFunction;

/**
 * Verify if a SQL function requires filtering date fields
 * @param {string} functionValue - Function name
 * @returns {boolean} - true if it requires filtering date fields
 */
export const shouldFilterDate = (functionValue) => {
    return isComparisonFunction(functionValue);
};

/**
 * Filter options by the selected SQL function
 * @param {Array} options - Array of options with data_type property
 * @param {string} functionValue - SQL function name
 * @returns {Array} - Filtered options array
 */
export const filterFieldsByFunction = (options, functionValue) => {
    if (!functionValue) {
        return options;
    }

    if (shouldFilterNumeric(functionValue)) {
        return options.filter((option) => {
            const dataType = option.data_type;
            return isNumericType(dataType);
        });
    }

    if (shouldFilterDate(functionValue)) {
        return options.filter((option) => {
            const dataType = option.data_type;
            return isDateType(dataType);
        });
    }

    return options;
};

/**
 * Normalize the name of a SQL function to lowercase
 * @param {string} functionValue - SQL function name
 * @returns {string} - Normalized function name or empty string if no value
 */
export const getFunctionName = (functionValue) => {
    if (!functionValue) return "";
    return String(functionValue).toLowerCase();
};
