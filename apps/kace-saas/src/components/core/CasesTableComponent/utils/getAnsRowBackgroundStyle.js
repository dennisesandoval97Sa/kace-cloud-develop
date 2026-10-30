/**
 * Returns the background style for a table row based on its ANS color.
 * Used when ans_display_mode is set to 'row'.
 *
 * @param {Object} row - The table row object
 * @param {Object} row.original - The original data for the row
 * @param {string} row.original.ansColor - The ANS color hex value (e.g., '#FF5733')
 * @returns {Object} Style object with backgroundColor property, or empty object if no color
 */
export const getAnsRowBackgroundStyle = (row) => {
    const ansColor = row.original?.ansColor;
    return ansColor ? { backgroundColor: `${ansColor}4D` } : {};
};
