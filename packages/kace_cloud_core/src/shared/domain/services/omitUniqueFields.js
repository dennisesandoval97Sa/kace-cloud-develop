const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Returns a copy of `data` without the values of the fields marked `unique` in `dataStructure`.
 * Walks nested object fields the same way as checkUniqueFields.
 * A value that is not a plain object (array, string, null) is returned as is: it has no fields to omit.
 *
 * @param {Object} dataStructure - The schema's data_structure object
 * @param {*} data
 * @returns {*}
 */
export function omitUniqueFields(dataStructure, data) {
    if (!isPlainObject(data)) return data;

    const result = { ...data };

    for (const [fieldName, fieldConfig] of Object.entries(dataStructure)) {
        if (fieldConfig.type === 'object' && fieldConfig.data_structure) {
            if (Object.hasOwn(result, fieldName)) {
                result[fieldName] = omitUniqueFields(fieldConfig.data_structure, result[fieldName]);
            }
            continue;
        }

        if (fieldConfig.unique) delete result[fieldName];
    }

    return result;
}
