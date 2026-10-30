import { ENTITY_STATE, FIELD_COLOR, FIELD_STATE } from "@kace_v2/shared/utils/board-colum-rules";
import {
    inferIsStatusColumn,
    isRawUnifiedActive,
    unifiedStatusBadgeInlineStyle,
} from "@kace_v2/features/boards/utils/boardStatusColumn.util";

export function getStateBadgeColumnKeys(columns = []) {
    const stateCol = columns.find((c) => c.entity === ENTITY_STATE && c.field === FIELD_STATE);
    const colorCol = columns.find((c) => c.entity === ENTITY_STATE && c.field === FIELD_COLOR);
    if (!stateCol || !colorCol) return null;
    return {
        stateKey: stateCol.alias || stateCol.field,
        colorKey: colorCol.alias || colorCol.field,
    };
}

export function wrapRowStateBadge(newItem, keys, getContrastColor) {
    if (!keys) return newItem;
    const { stateKey, colorKey } = keys;
    const stateVal = newItem[stateKey];
    const colorVal = newItem[colorKey];
    if (stateVal == null || stateVal === "" || !colorVal) return newItem;
    return {
        ...newItem,
        [stateKey]: (
            <div
                style={{
                    backgroundColor: colorVal,
                    color: getContrastColor(colorVal),
                    padding: "4px 8px",
                    borderRadius: "6px",
                    display: "inline-block",
                    fontWeight: 500,
                }}
            >
                {stateVal}
            </div>
        ),
    };
}

export function getUnifiedStatusBadgeColumnKeys(columns = []) {
    return columns
        .filter((column) => inferIsStatusColumn(column))
        .map((column) => column.alias || column.field)
        .filter(Boolean);
}

export function wrapRowUnifiedStatusBadge(newItem, keys, t) {
    if (!Array.isArray(keys) || keys.length === 0) return newItem;
    let result = { ...newItem };
    keys.forEach((key) => {
        const value = result[key];
        if (value === null || value === undefined) return;
        const isActive = isRawUnifiedActive(value);
        result = {
            ...result,
            [key]: (
                <div style={unifiedStatusBadgeInlineStyle(isActive)}>
                    {isActive
                        ? t("boards.boardView.status.active", { defaultValue: "Activo" })
                        : t("boards.boardView.status.inactive", { defaultValue: "Inactivo" })}
                </div>
            ),
        };
    });
    return result;
}
