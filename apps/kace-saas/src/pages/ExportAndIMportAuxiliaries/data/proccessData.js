import { useTranslation } from "react-i18next";

/**
 * Recursively flattens nested object properties into :: notation paths
 * Handles multiple structure formats from the KACE schema API:
 * 1. With "data_structure" key: { progreso: { type: "object", data_structure: { inicio: {...} } } }
 * 2. With "properties" key: { progreso: { properties: { inicio: {...} } } }
 * 3. Direct nested objects: { progreso: { inicio: {...}, fin: {...} } }
 *
 * Adds `required` boolean when present in leaf nodes so UI can
 * highlight mandatory columns.
 *
 * @param {Object} structure - The data_structure object from schema
 * @param {string} prefix - Current path prefix for nested properties
 * @returns {Array<{path: string, type: string, label: string, required: boolean}>} - Flattened field definitions
 */
export const flattenNestedProperties = (structure, prefix = "") => {
    const fields = [];

    for (const [key, value] of Object.entries(structure)) {
        const currentPath = prefix ? `${prefix}::${key}` : key;

        // Skip if value is null or undefined (treat as simple string field)
        if (!value || typeof value !== "object") {
            fields.push({
                path: currentPath,
                type: "String",
                label: key,
                required: false,
            });
            continue;
        }

        // PRIORITY 1: value has nested data_structure
        if (value.data_structure && typeof value.data_structure === "object") {
            const nestedFields = flattenNestedProperties(value.data_structure, currentPath);
            fields.push(...nestedFields);
            continue;
        }

        // PRIORITY 2: value has explicit properties
        if (value.properties && typeof value.properties === "object") {
            const nestedFields = flattenNestedProperties(value.properties, currentPath);
            fields.push(...nestedFields);
            continue;
        }

        // PRIORITY 3: Leaf with type
        if (value.type) {
            fields.push({
                path: currentPath,
                type: value.type || "String",
                label: value.label || key,
                required: Boolean(value.required),
            });
            continue;
        }

        // PRIORITY 4: Mixed object - attempt to detect nested objects
        const hasNestedObjects = Object.values(value).some(
            (v) =>
                v && typeof v === "object" && (v.type || v.properties || v.data_structure || Object.keys(v).length > 0),
        );

        if (hasNestedObjects) {
            const nestedFields = flattenNestedProperties(value, currentPath);
            fields.push(...nestedFields);
        } else {
            // Treat as simple object leaf
            fields.push({
                path: currentPath,
                type: "Object",
                label: key,
                required: Boolean(value.required),
            });
        }
    }

    return fields;
};

export const formatFieldName = (name) => {
    if (!name) return "";
    return name
        .replace(/::/g, " - ")
        .replace(/_/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
};

export const generateExampleValue = (dataType, columnName) => {
    const type = dataType?.toLowerCase() || "";
    const colName = columnName?.toLowerCase() || "";

    // Special handling for id column
    if (colName === "id") {
        return "12345";
    }

    if (type.includes("string") || type.includes("text")) {
        return "ejemplo_texto";
    }
    if (type.includes("number") || type.includes("int") || type.includes("decimal")) {
        return "123";
    }
    if (type.includes("date") || type.includes("datetime")) {
        return "2025-11-22";
    }
    if (type.includes("boolean") || type.includes("bool")) {
        return "true";
    }
    if (type.includes("email")) {
        return "ejemplo@correo.com";
    }
    if (type.includes("phone")) {
        return "3001234567";
    }
    return "valor_ejemplo";
};

// Filter out reserved definitions "cases" and "clients"
export const typeForm = (data) => {
    try {
        const arr = Array.isArray(data) ? data : [];
        const fromKey = arr.find((e) => e && e.key === "data");
        const items = Array.isArray(fromKey?.value)
            ? fromKey.value
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data)
                ? data
                : [];

        const filtered = items.filter((item) => {
            const n = (item?.name ?? "").toString().trim().toLowerCase();
            return n !== "cases" && n !== "clients";
        });

        return filtered.map((item) => ({
            label: item?.name ?? "",
            value: item?.schema_id ?? item?.id ?? "",
        }));
    } catch (_) {
        // Errors are intentionally not logged or thrown to prevent flow interruption
        return [];
    }
};

// Ejemplos según tipo/campo
export const handleColumnsExamples = (item) => {
    const { type, nameColumn } = item;
    const statusFields = ["status", "is_active"];
    if (!type) return "Ejemplo";
    const normalizedType = type.toLowerCase();
    if (nameColumn.includes("grupos")) return "1,2,3 (Separar por comas)";
    if (nameColumn === "codigos_externos") return "1,2,3 (Separar por comas)";
    if (statusFields.includes(nameColumn)) return "1-activo, 2-inactivo";
    switch (normalizedType) {
        case "string":
        case "text":
            return "Abcdefgh";
        case "number":
        case "integer":
            return "1234";
        case "float":
        case "decimal":
            return "123.45";
        case "date":
        case "datetime":
            return "2025-03-03T14:30:00Z";
        case "boolean":
        case "bool":
            return "true o false";
        case "array":
            return "[valor1, valor2]";
        case "object":
        case "json":
            return '{"clave": "valor"}';
        case "email":
            return "ejemplo@correo.com";
        case "url":
            return "https://ejemplo.com";
        case "phone":
            return "+57 300 123 4567";
        default:
            return "Ejemplo";
    }
};

// Traduce tipo a etiqueta
export const handleTypeDate = (type, t) => {
    if (!type) return "Texto";
    const normalizedType = type.toLowerCase();
    const typeMap = {
        date: t("actions.labels.date"),
        datetime: "Fecha y Hora",
        number: t("jsonEditor.types.number"),
        integer: "Entero",
        float: "Decimal",
        string: t("actions.labels.text"),
        text: "Texto",
        object: t("jsonEditor.types.object"),
        array: "Lista",
        boolean: t("jsonEditor.types.boolean"),
        bool: "Booleano",
        email: "Correo Electrónico",
        url: "URL",
        phone: t("generalSetup.form.label.phone"),
        json: "JSON",
    };
    return typeMap[normalizedType] || type;
};
