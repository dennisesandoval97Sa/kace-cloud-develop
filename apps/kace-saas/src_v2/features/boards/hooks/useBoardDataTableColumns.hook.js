import { useMemo } from "react";
import { formatColumnLabel } from "@kace_v2/shared/utils/format-column-label.util";
import { applyColumnRules } from "@kace_v2/shared/helper/applyColumnRules";

export const useBoardDataTableColumns = (boardConfig, showDeleteAction) =>
    useMemo(() => {
        if (!boardConfig?.columns) return [];

        const processedColumns = applyColumnRules(boardConfig.columns.filter((col) => col.visible !== false));

        const hasActionsColumn = Boolean(boardConfig.options) || showDeleteAction;

        const response = processedColumns.map((column) => {
            const label = column.alias || column.field;
            return {
                key: label,
                header: formatColumnLabel(label),
                sortable: true,
            };
        });

        if (hasActionsColumn) {
            response.unshift({ key: "actions", header: "", width: "10%" });
        }

        return response;
    }, [boardConfig, showDeleteAction]);
