/**
 * Remove the id property from each having object in the array
 * @param {Array} havings - Array of having objects
 * @returns {Array} - Array of havings without id property
 */
export const removeIds = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map(({ id, ...item }) => item);
};
