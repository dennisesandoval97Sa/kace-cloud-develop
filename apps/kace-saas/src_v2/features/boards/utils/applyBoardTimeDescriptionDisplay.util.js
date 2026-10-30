import { formatLocalizedTimeDescription, TIME_DESCRIPTION_FIELDS } from "@/utils/src/utils/timeDescriptionPrefix";

export function applyBoardTimeDescriptionDisplay(row, columnsConfig = [], showPrefixes = true, t) {
    if (!row) return row;

    let changed = false;
    const next = { ...row };
    for (const column of columnsConfig) {
        if (!TIME_DESCRIPTION_FIELDS.includes(column.field)) continue;

        const key = column.alias || column.field;
        if (!(key in next)) continue;

        const formatted = formatLocalizedTimeDescription(next[key], { showPrefixes, t });
        if (formatted !== next[key]) {
            next[key] = formatted;
            changed = true;
        }
    }
    return changed ? next : row;
}
