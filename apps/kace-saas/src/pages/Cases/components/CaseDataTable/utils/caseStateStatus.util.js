import { getContrastForeground } from "@kace_v2/shared/utils/get-contrast-foreground.util";

export const CASE_STATE_ACCESSOR_KEYS = new Set(["estadoactual", "estado_actual", "estadoActual"]);

export const STATUS_CELL_TYPES = new Set(["estado", "status"]);

export const isStatusCellType = (cellType) => STATUS_CELL_TYPES.has(cellType);

export const getStatusColumn = (columns = []) => columns.find((column) => isStatusCellType(column?.cell_type)) ?? null;

export const IMPORT_STATUS_VALUES = new Set([
    "pending",
    "completed",
    "rejected",
    "incompleted",
    "processing",
    "failed",
]);

export const isCaseStateAccessorKey = (accessorKey) => CASE_STATE_ACCESSOR_KEYS.has(accessorKey);

export const buildStatusColorMap = (countByStatus = []) =>
    countByStatus.reduce((map, item) => {
        if (item?.status && item?.color) {
            map[item.status] = item.color;
        }
        return map;
    }, {});

export const getCaseStateBadgeStyle = (stateName, colorMap = {}) => {
    const color = colorMap[stateName];

    if (!color) {
        return null;
    }

    return {
        backgroundColor: color,
        color: getContrastForeground(color),
    };
};

export const getImportStatusBadgeStyle = (value, translatedActive = []) => {
    if (value === "processing") {
        return { backgroundColor: "#E78C5070", color: "#E78C50" };
    }

    if (value === "completed" || translatedActive.includes(value)) {
        return { backgroundColor: "#2A9D9070", color: "#2A9D90" };
    }

    if (value === "pending") {
        return { backgroundColor: "#EEF2FF", color: "#3730A3" };
    }

    return { backgroundColor: "#E76E5080", color: "#E76E50" };
};
