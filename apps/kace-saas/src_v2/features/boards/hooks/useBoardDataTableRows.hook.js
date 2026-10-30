import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@kace_v2/shared/utils/format-number.util";
import { formatDate } from "@kace_v2/shared/utils/format-date.util";
import { SQL } from "@kace_v2/shared/constants/sql.constants";
import {
    getStateBadgeColumnKeys,
    getUnifiedStatusBadgeColumnKeys,
    wrapRowStateBadge,
    wrapRowUnifiedStatusBadge,
} from "@kace_v2/features/boards/utils/boardStateBadgeRows.util";
import { getAnsColumnKeys, getAnsColorMap, wrapRowAns } from "@kace_v2/features/boards/utils/boardAnsRows.util";
import { applyBoardTimeDescriptionDisplay } from "@kace_v2/features/boards/utils/applyBoardTimeDescriptionDisplay.util";

export const useBoardDataTableRows = (
    boardConfig,
    boardResources,
    getContrastColor,
    ansItems = [],
    showTimeDescriptionPrefixes = true,
) => {
    const { t } = useTranslation();
    return useMemo(() => {
        const columnsConfig = boardConfig?.columns || [];
        if (!columnsConfig.length) return boardResources ?? [];

        const formatRowsConfig = columnsConfig
            .filter(
                (el) =>
                    (el.data_type === "DATE" || el.data_type === "NUMBER") &&
                    el.function !== SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE,
            )
            .map((column) => ({
                key: column.alias || column.field,
                format: column.format,
                data_type: column.data_type,
            }));
        const stateBadgeKeys = getStateBadgeColumnKeys(columnsConfig);
        const unifiedStatusKeys = getUnifiedStatusBadgeColumnKeys(columnsConfig);
        const ansKeys = getAnsColumnKeys(columnsConfig);
        const ansColors = getAnsColorMap(ansItems);
        return boardResources.map((item) => {
            let newItem = { ...item };
            formatRowsConfig.forEach(({ key, format, data_type }) => {
                if (key in newItem && newItem[key]) {
                    const applyFormat = data_type === "NUMBER" ? formatNumber : formatDate;
                    newItem[key] = applyFormat(newItem[key], format);
                }
            });
            newItem = applyBoardTimeDescriptionDisplay(newItem, columnsConfig, showTimeDescriptionPrefixes, t);
            newItem = wrapRowStateBadge(newItem, stateBadgeKeys, getContrastColor);
            newItem = wrapRowUnifiedStatusBadge(newItem, unifiedStatusKeys, t);
            newItem = wrapRowAns(newItem, ansKeys, ansColors, t);
            return newItem;
        });
    }, [boardConfig, boardResources, getContrastColor, t, ansItems, showTimeDescriptionPrefixes]);
};
