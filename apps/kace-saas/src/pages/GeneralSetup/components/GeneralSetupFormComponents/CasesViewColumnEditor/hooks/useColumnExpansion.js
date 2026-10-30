import { useMemo } from "react";

/**
 * useColumnExpansion - Hook to detect nivel pattern columns and expand to all available levels
 *
 * @param {string} columnName - The column name to check (e.g., "nivel1")
 * @param {string} viewName - The view name to look up in schemaFields
 * @param {Object} schemaFields - Object mapping viewName to array of SchemaColumn objects
 *
 * @returns {Object} {
 *   hasLevelPattern: boolean,                          // true if columnName matches /^nivel\d+$/i
 *   availableLevels: SchemaColumn[],                   // columns from schemaFields[viewName] matching pattern, sorted numerically
 *   expandToAllLevels: (cell_type, header_label_override?) => VisibleColumn[]
 * }
 */
export default function useColumnExpansion(columnName, viewName, schemaFields) {
    return useMemo(() => {
        // Pattern: ^nivel followed by 1-10 (not 11+), case-insensitive
        // Matches: nivel1, nivel2, ..., nivel10
        // Does NOT match: nivel, nivel11, nivel_cliente, nuevo_nivel
        const NIVEL_PATTERN = /^nivel([1-9]|10)$/i;

        // Check if columnName matches the nivel pattern
        const hasLevelPattern = NIVEL_PATTERN.test(columnName || "");

        // Extract available levels from the schema
        let availableLevels = [];

        if (hasLevelPattern && viewName && schemaFields && schemaFields[viewName]) {
            const viewColumns = schemaFields[viewName];

            // Filter columns that match the nivel pattern
            availableLevels = viewColumns.filter((col) => NIVEL_PATTERN.test(col.column_name || ""));

            // Sort numerically by the numeric suffix
            availableLevels.sort((a, b) => {
                const numA = parseInt(a.column_name.replace(/^nivel/i, ""), 10);
                const numB = parseInt(b.column_name.replace(/^nivel/i, ""), 10);
                return numA - numB;
            });
        }

        // Function to expand the matched levels to VisibleColumn array
        const expandToAllLevels = (cell_type, header_label_override) => {
            return availableLevels.map((col) => ({
                column_name: col.column_name,
                header_label: header_label_override || col.label || col.column_name,
                cell_type,
                // separator: undefined is implied — not included in the object
            }));
        };

        return {
            hasLevelPattern,
            availableLevels,
            expandToAllLevels,
        };
    }, [columnName, viewName, schemaFields]);
}
