/**
 * Remov the entity prefix from auxiliary entity options.
 * For example "aux_cases.form1.age" = "form1.age"
 *
 * @param {Array} options - array of option objects with value and label properties
 * @param {string} entity - the entity name ("aux_cases")
 * @returns {Array} processed options with entity prefix removed from value and label
 */
export const processAuxiliaryOptions = (options, entity) => {
    if (!Array.isArray(options) || !entity || !entity.includes("aux_")) {
        return options;
    }

    const prefix = `${entity}.`;
    return options.map((option) => {
        const value = option.value?.startsWith(prefix) ? option.value.substring(prefix.length) : option.value;
        const label = option.label?.startsWith(prefix) ? option.label.substring(prefix.length) : option.label;
        return { ...option, value, label };
    });
};

/**
 * normalize a field value by removing the entity prefix if it exists.
 * used when editin to match the processed options format.
 *
 * @param {string} field - the field value ("aux_cases.form1.age" || "form1.age")
 * @param {string} entity - the entity name ("aux_cases")
 * @returns {string} normalized field value without entity prefix
 */
export const normalizeAuxiliaryField = (field, entity) => {
    if (!field || !entity || !entity.includes("aux_")) {
        return field;
    }

    const prefix = `${entity}.`;
    if (field.startsWith(prefix)) {
        return field.substring(prefix.length);
    }

    return field;
};

