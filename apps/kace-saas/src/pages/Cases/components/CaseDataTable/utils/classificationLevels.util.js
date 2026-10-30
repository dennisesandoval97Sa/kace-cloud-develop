import {
    CLASSIFICATION_LEVEL_KEYS,
    getExpandableClassificationLevelsFromRow,
    getFilledClassificationLevels,
    isNivelColumn,
    MAX_CLASSIFICATION_LEVELS,
    NIVEL_COLUMN_PATTERN,
    parseNivelNumber,
} from "@/utils/classificationLevels";

export {
    CLASSIFICATION_LEVEL_KEYS,
    getExpandableClassificationLevelsFromRow,
    getFilledClassificationLevels,
    isNivelColumn,
    MAX_CLASSIFICATION_LEVELS,
    NIVEL_COLUMN_PATTERN,
    parseNivelNumber,
};

/**
 * Highest classification level actually present in a DB schema (e.g. a custom
 * admin view's real columns). Used to cap level-picker UIs and filters to what
 * the active view supports, since custom views aren't guaranteed to expose
 * nivel1..nivel10 the way the default view (joined to `clasificaciones`) does.
 *
 * @param {Array<{column_name: string}>} schema
 * @returns {number} 0 when no nivel column is present.
 */
export const getMaxAvailableNivelLevel = (schema = []) =>
    (schema ?? []).reduce((max, column) => {
        const level = parseNivelNumber(column?.column_name);
        return level !== null && level > max ? level : max;
    }, 0);

export const getClassificationDisplay = (row = {}, rootColumnName = "nivel1") => {
    const filledLevels = getFilledClassificationLevels(row);

    if (!filledLevels.length) {
        return { label: "", count: 0, hasExpandableChildren: false };
    }

    const expandChildren = getExpandableClassificationLevelsFromRow(row, rootColumnName);

    return {
        label: filledLevels[0].label,
        count: filledLevels.length,
        hasExpandableChildren: expandChildren.length > 0,
    };
};

export const getClassificationChildren = (children = [], rootColumnName) => {
    const rootLevel = parseNivelNumber(rootColumnName);
    if (!rootLevel) return children;

    return children.filter((child) => {
        const level = parseNivelNumber(child.id);
        return level !== null && level > rootLevel;
    });
};

export const isEmptyClassificationValue = (value) => value === null || value === undefined || value === "";

export const parseSeparatorClassificationValue = (value, separator) => {
    if (isEmptyClassificationValue(value) || !separator) {
        return [];
    }

    if (typeof value !== "string") {
        const label = String(value);

        return [
            {
                id: "level-1",
                label,
                value: label,
                level: 1,
            },
        ];
    }

    return value
        .split(separator)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((label, index) => ({
            id: `level-${index + 1}`,
            label,
            value: label,
            level: index + 1,
        }));
};

export const getFilledSeparatorClassificationLevels = (row = {}, accessorKey, separator) =>
    parseSeparatorClassificationValue(row[accessorKey], separator);

export const getExpandableSeparatorClassificationLevelsFromRow = (row, accessorKey, separator) => {
    const filledLevels = getFilledSeparatorClassificationLevels(row, accessorKey, separator);
    return filledLevels.slice(1);
};

export const getSeparatorClassificationDisplay = (row = {}, accessorKey, separator) => {
    const filledLevels = getFilledSeparatorClassificationLevels(row, accessorKey, separator);

    if (!filledLevels.length) {
        return { label: "", count: 0, hasExpandableChildren: false };
    }

    const expandChildren = getExpandableSeparatorClassificationLevelsFromRow(row, accessorKey, separator);

    return {
        label: filledLevels[0].label,
        count: filledLevels.length,
        hasExpandableChildren: expandChildren.length > 0,
    };
};

export const getClassificationLevelNumber = (id) => {
    const nivelMatch = String(id ?? "").match(/nivel(\d+)/i);
    if (nivelMatch) {
        return nivelMatch[1];
    }

    const levelMatch = String(id ?? "").match(/level-(\d+)/i);
    if (levelMatch) {
        return levelMatch[1];
    }

    return id;
};

export const isSeparatorClassificationColumn = (column) =>
    column?.cell_type === "clasificacion" && !isNivelColumn(column?.column_name) && Boolean(column?.separator?.trim());

export const wouldBeExpandableClassificationColumn = (column) => {
    if (column?.cell_type !== "clasificacion" || column.expand_levels === false) {
        return false;
    }

    return isNivelColumn(column?.column_name) || isSeparatorClassificationColumn(column);
};

export const shouldExpandClassificationLevels = (column) => wouldBeExpandableClassificationColumn(column);

export const isExpandableClassificationColumn = (column) => shouldExpandClassificationLevels(column);

export const getRowExpandableClassificationLevels = (row, column) => {
    if (!column) {
        return row?.children ?? [];
    }

    if (isSeparatorClassificationColumn(column)) {
        return getExpandableSeparatorClassificationLevelsFromRow(row, column.column_name, column.separator);
    }

    return getExpandableClassificationLevelsFromRow(row, column.column_name);
};

export const getExpandableClassificationColumn = (columns = []) =>
    columns.find(isExpandableClassificationColumn) ?? null;

export const isClassificationCellType = (cellType) => cellType === "clasificacion";

export const getClassificationColumn = (columns = []) =>
    columns.find((col) => isClassificationCellType(col?.cell_type)) ?? null;
