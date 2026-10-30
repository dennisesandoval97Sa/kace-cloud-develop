import { toast } from "sonner";

/**
 * Generates auxiliary select options from a schema's data structure.
 * Recursively traverses nested objects and arrays (when enabled) to build field paths.
 *
 * @param {Object} schema - Schema object with id and data_structure.
 * @param {Function} [t] - Translation function for localized error toasts.
 * @param {string} [model] - Optional model prefix prepended to value and label.
 * @param {Function|Object} [filterFnOrOptions] - Optional filter function or options object.
 * @param {Object} [options] - Options object when filterFn is supplied as 4th argument.
 * @param {boolean} [options.includeArrays=true] - Whether to descend into and emit array fields.
 * @returns {Array<{value: string, label: string, id: string, data_type: string}>} Generated select options.
 */
export const generateAuxSelectOptions = (schema, t = () => {}, model = "", filterFnOrOptions, options = {}) => {
    if (!schema || typeof schema !== "object" || !schema.id) {
        return [];
    }

    const filterFn = typeof filterFnOrOptions === "function" ? filterFnOrOptions : undefined;
    const resolvedOptions =
        typeof filterFnOrOptions === "object" && filterFnOrOptions !== null ? filterFnOrOptions : options;
    const { includeArrays = true } = resolvedOptions;

    const fields = [];
    const schemaId = schema.id;
    const maxDepth = 10;

    const traverseDataStructure = (dataStructure, currentPath = "", depth = 0, cameFromArray = false) => {
        if (depth > maxDepth || !dataStructure || typeof dataStructure !== "object") {
            return;
        }

        Object.entries(dataStructure).forEach(([key, value]) => {
            if (typeof key !== "string" || key.trim() === "" || !value || typeof value !== "object") {
                return;
            }

            const { type, data_structure: nestedDataStructure } = value;
            const newPath = currentPath ? `${currentPath}.${key}` : key;

            if (type === "array" && nestedDataStructure && typeof nestedDataStructure === "object") {
                if (!includeArrays) {
                    return;
                }

                Object.entries(nestedDataStructure).forEach(([arrayKey, arrayValue]) => {
                    if (!arrayValue || typeof arrayValue !== "object") return;

                    const arrayDataType = arrayValue.type;
                    const arrayNestedStructure = arrayValue.data_structure;
                    const arrayItemPath = `${newPath}.${arrayKey}`;

                    if (
                        arrayNestedStructure &&
                        typeof arrayNestedStructure === "object" &&
                        arrayDataType === "object" &&
                        !cameFromArray
                    ) {
                        traverseDataStructure(arrayNestedStructure, arrayItemPath, depth + 1, true);
                    } else if (arrayDataType && arrayDataType !== "object" && arrayDataType !== "array") {
                        if (typeof filterFn === "function" && !filterFn(arrayValue)) return;
                        fields.push({
                            value: model ? `${model}.${arrayItemPath}` : arrayItemPath,
                            label: model ? `${model}.${arrayItemPath}` : arrayItemPath,
                            id: `${schemaId}_${arrayItemPath}`,
                            data_type: arrayDataType,
                        });
                    } else if (arrayDataType === "object" && cameFromArray) {
                        if (typeof filterFn === "function" && !filterFn(arrayValue)) return;
                        fields.push({
                            value: model ? `${model}.${arrayItemPath}` : arrayItemPath,
                            label: model ? `${model}.${arrayItemPath}` : arrayItemPath,
                            id: `${schemaId}_${arrayItemPath}`,
                            data_type: "object",
                        });
                    }
                });
            } else if (type === "object" && nestedDataStructure && typeof nestedDataStructure === "object") {
                traverseDataStructure(nestedDataStructure, newPath, depth + 1, false);
            } else if (type && type !== "object" && type !== "array") {
                if (typeof filterFn === "function" && !filterFn(value)) return;
                fields.push({
                    value: model ? `${model}.${newPath}` : newPath,
                    label: model ? `${model}.${newPath}` : newPath,
                    id: `${schemaId}_${newPath}`,
                    data_type: type,
                });
            }
        });
    };

    try {
        if (!schema.data_structure) {
            return fields;
        }

        traverseDataStructure(schema.data_structure);

        return fields;
    } catch {
        // NO-SONAR: Si ocurre un error, se muestra un mensaje genérico al usuario y se continúa con las opciones ya generadas.
        const toastId = "auxOptionsError";

        toast.error(t("app.alerts.auxOptionsError"), {
            id: toastId,
        });

        return fields;
    }
};
