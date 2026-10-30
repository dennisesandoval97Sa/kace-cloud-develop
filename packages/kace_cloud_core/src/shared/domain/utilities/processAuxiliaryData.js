import { ValidationFailError } from '../../errors/ValidationFailError';
import { v4 as uuid } from 'uuid';
import { Helper } from '../../index';

export function generateHeadersFromSchema(dataStructure, prefix = '') {
    const headers = [];

    for (const [key, config] of Object.entries(dataStructure)) {
        const fullKey = prefix ? `${prefix}::${key}` : key;

        if (config.type === 'array' && config.data_structure) {
            for (const [nestedKey] of Object.entries(config.data_structure)) {
                headers.push(`${key}::${nestedKey}`);
            }
        } else if (config.type === 'object' && config.data_structure) {
            for (const [nestedKey] of Object.entries(config.data_structure)) {
                headers.push(`${key}::${nestedKey}`);
            }
        } else {
            headers.push(fullKey);
        }
    }

    return headers;
}

export function getFieldTypes(dataStructure) {
    const arrayFields = new Set();
    const objectFields = new Set();

    for (const [key, config] of Object.entries(dataStructure)) {
        if (config.type === 'array') {
            arrayFields.add(key);
        } else if (config.type === 'object' && config.data_structure) {
            objectFields.add(key);
        }
    }

    return { arrayFields, objectFields };
}

/**
 * Construye JSON desde CSV usando el esquema para determinar tipos correctamente.
 * @param {Object[]} csvContent - Filas del CSV parseado
 * @param {Object} dataStructure - Estructura del esquema (opcional pero recomendado)
 */
export function buildAuxJsonFromCsv(csvContent, dataStructure = null) {
    const recordsMap = new Map();

    const { arrayFields, objectFields } = dataStructure
        ? getFieldTypes(dataStructure)
        : { arrayFields: new Set(), objectFields: new Set() };

    for (const row of csvContent) {
        if (!row.id) {
            row.id = uuid();
        }

        if (!recordsMap.has(row.id)) {
            const base = { id: row.id };

            for (const [col, value] of Object.entries(row)) {
                if (col === 'id' || col.includes('::')) continue;
                if (value === undefined || value === null || value === '') continue;
                base[col] = value;
            }

            for (const arrayField of arrayFields) {
                base[arrayField] = [];
            }

            recordsMap.set(row.id, base);
        }

        const record = recordsMap.get(row.id);

        const groupsForRow = {};
        for (const [col, value] of Object.entries(row)) {
            if (value === undefined || value === null || value === '') continue;

            const parts = col.split('::');
            if (parts.length !== 2) continue;

            const [group, field] = parts;
            if (!groupsForRow[group]) {
                groupsForRow[group] = {};
            }
            groupsForRow[group][field] = value;
        }

        for (const [group, groupData] of Object.entries(groupsForRow)) {
            if (Object.keys(groupData).length === 0) continue;

            if (arrayFields.has(group)) {
                if (!record[group]) record[group] = [];

                const exists = record[group].some((item) => JSON.stringify(item) === JSON.stringify(groupData));
                if (!exists) {
                    record[group].push(groupData);
                }
            } else if (objectFields.has(group)) {
                record[group] = groupData;
            } else {
                if (!record[group]) {
                    record[group] = groupData;
                } else if (Array.isArray(record[group])) {
                    const exists = record[group].some((item) => JSON.stringify(item) === JSON.stringify(groupData));
                    if (!exists) {
                        record[group].push(groupData);
                    }
                } else {
                    if (JSON.stringify(record[group]) !== JSON.stringify(groupData)) {
                        record[group] = [record[group], groupData];
                    }
                }
            }
        }
    }

    return Array.from(recordsMap.values());
}

/**
 * Aplana una fila auxiliar para exportación CSV.
 * @param {Object} row - Fila con id y data
 * @param {string[]} headers - Headers solicitados
 * @param {Object} dataStructure - Estructura del esquema (opcional pero recomendado)
 */
export function flattenAuxRow(row, headers, dataStructure = null) {
    const { id } = row;
    let payload = row.data;

    if (!payload) return [];

    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (e) {
            Helper.logError(e);
            throw new ValidationFailError(
                `El registro con id "${id}" tiene un JSON inválido en la columna "data".`,
                'data'
            );
        }
    }

    if (typeof payload !== 'object' || Array.isArray(payload)) {
        throw new ValidationFailError(`El registro con id "${id}" tiene un formato inesperado en "data".`, 'data');
    }

    const { arrayFields, objectFields } = dataStructure
        ? getFieldTypes(dataStructure)
        : { arrayFields: new Set(), objectFields: new Set() };

    const baseRow = {};
    const baseHeaders = headers && headers.length > 0 ? headers.filter((h) => h !== 'data') : ['id'];

    for (const col of baseHeaders) {
        if (Object.prototype.hasOwnProperty.call(row, col)) {
            baseRow[col] = row[col];
        }
    }

    const scalarFields = {};
    const objectGroups = {};
    const arrayGroups = {};

    for (const [key, value] of Object.entries(payload)) {
        if (value === null || value === undefined) {
            scalarFields[key] = null;
        } else if (arrayFields.has(key)) {
            arrayGroups[key] = Array.isArray(value) ? value : [value];
        } else if (objectFields.has(key)) {
            objectGroups[key] = Array.isArray(value) ? value[0] : value;
        } else if (Array.isArray(value)) {
            arrayGroups[key] = value;
        } else if (typeof value === 'object') {
            objectGroups[key] = value;
        } else {
            scalarFields[key] = value;
        }
    }

    for (const [field, v] of Object.entries(scalarFields)) {
        baseRow[field] = v;
    }

    for (const [group, obj] of Object.entries(objectGroups)) {
        if (!obj || typeof obj !== 'object') continue;
        for (const [field, v] of Object.entries(obj)) {
            baseRow[`${group}::${field}`] = v;
        }
    }

    const rows = [];
    const arrayGroupKeys = Object.keys(arrayGroups);

    if (arrayGroupKeys.length === 0) {
        rows.push(baseRow);
        return rows;
    }

    const maxLen = Math.max(...arrayGroupKeys.map((k) => (arrayGroups[k] || []).length));

    if (maxLen === 0) {
        rows.push(baseRow);
        return rows;
    }

    for (let i = 0; i < maxLen; i++) {
        const rowCopy = { ...baseRow };
        for (const groupKey of arrayGroupKeys) {
            const element = (arrayGroups[groupKey] || [])[i];
            if (element && typeof element === 'object') {
                for (const [field, v] of Object.entries(element)) {
                    rowCopy[`${groupKey}::${field}`] = v;
                }
            }
        }
        rows.push(rowCopy);
    }

    return rows;
}
