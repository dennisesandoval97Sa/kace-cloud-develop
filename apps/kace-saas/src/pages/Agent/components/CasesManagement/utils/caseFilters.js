export const getAgentOpenCasesFilter = (userId) => [
    {
        column: "responsable_id",
        value: userId,
        type: "AND",
        operator: "eq",
    },
    {
        column: "fecha_resolucion",
        value: "null",
        type: "AND",
        operator: "null",
    },
    {
        column: "parent_id",
        value: "null",
        type: "AND",
        operator: "null",
    },
];

/**
 * Generates a filter to retrieve open cases created by a specific user.
 *
 * @param {string | number} userId - The ID of the user who created the cases.
 * @returns {Array<Object>} Filters to be applied in the query.
 */
export const getOpenCasesCreatedByUserFilter = (userId, isCustomViewEnabled = false) => [
    {
        column: isCustomViewEnabled ? "created_by" : "cases.created_by",
        value: userId,
        type: "AND",
        operator: "eq",
    },
    {
        column: "fecha_resolucion",
        value: "null",
        type: "AND",
        operator: "null",
    },
    {
        column: "parent_id",
        value: "null",
        type: "AND",
        operator: "null",
    },
];
