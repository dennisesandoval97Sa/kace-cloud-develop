import { Uuid } from "@kace/plugins";

export const schemaToInternal = (data) => {
    if (!data) {
        return [];
    }
    return Object.entries(data).map(([key, val]) => {
        const entry = { id: Uuid(), name: key, type: val.type };
        if (val.type === "object") {
            entry.value = schemaToInternal(val.data_structure);
        } else if (val.type === "array") {
            entry.template = schemaToInternal(val.data_structure);
            entry.items = [];
            entry.allowDynamicProperties = true;
        } else {
            entry.value = "";
        }
        return entry;
    });
};

export const transformToInternal = (data) => {
    return Object.entries(data).map(([key, val]) => {
        const entry = { id: Uuid(), name: key, type: '', value: null };
        if (Array.isArray(val)) {
            entry.type = 'array';
            entry.value = val; 
        } else if (typeof val === 'object' && val !== null) {
            entry.type = 'object';
            entry.value = transformToInternal(val);
        } else {
            entry.type = typeof val;
            entry.value = val;
        }
        return entry;
    });
};

export const transformToJSON = (properties) => {
    if (!Array.isArray(properties)) return {};

    return properties.reduce((acc, prop) => {
        if (!prop.name) return acc;

        if (prop.type === 'object') {
            acc[prop.name] = transformToJSON(prop.value);
        } else if (prop.type === 'array') {
            acc[prop.name] = (prop.items || []).map(itemProperties => {
                return transformToJSON(itemProperties);
            });
        } else {
            acc[prop.name] = prop.value;
        }
        return acc;
    }, {});
};

export const transformNonEmptyToJSON = (properties) => {
    if (!Array.isArray(properties)) {
        return {};
    }

    return properties.reduce((acc, prop) => {
        const { name, type, value, items } = prop;

        if (!name) {
            return acc;
        }

        if (type === 'object') {
            const nestedJson = transformNonEmptyToJSON(value);
            if (Object.keys(nestedJson).length > 0) {
                acc[name] = nestedJson;
            }
        } else if (type === 'array') {
            const finalArrayItems = (items || [])
                .map(itemProperties => transformNonEmptyToJSON(itemProperties))
                .filter(itemObject => Object.keys(itemObject).length > 0);

            if (finalArrayItems.length > 0) {
                acc[name] = finalArrayItems;
            }
        } else {
            const isNullOrUndefined = value === null || value === undefined;
            const isEmptyString = typeof value === 'string' && value.trim() === '';

            if (!isNullOrUndefined && !isEmptyString) {
                acc[name] = value;
            }
        }

        return acc;
    }, {});
};