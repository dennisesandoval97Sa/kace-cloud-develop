import { BOARD_COLUMN_RULES } from "../utils/board-colum-rules";

export const applyColumnRules = (columns = []) => {
    if (!columns.length) return columns;

    let result = [...columns];

    BOARD_COLUMN_RULES.HIDE_IF_EXISTS.forEach((rule) => {
        const existsDependency = columns.some(
            (col) => col.field === rule.dependsOn.field && col.entity === rule.dependsOn.entity,
        );

        if (existsDependency) {
            result = result.filter((col) => !(col.field === rule.target.field && col.entity === rule.target.entity));
        }
    });

    return result;
};
