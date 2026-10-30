import { useMemo } from "react";
import { BOARD_TABLE_SCOPE } from "@kace_v2/features/boards/constants/boardTableScope.constants";
import { isCasesLikeEntity } from "@kace_v2/features/boards/utils/casesEntity.util";

const DELETE_FLAG_BY_SCOPE = {
    [BOARD_TABLE_SCOPE.ADMIN]: "can_admin_delete_record",
    [BOARD_TABLE_SCOPE.AGENT]: "can_agent_delete_record",
};

const BULK_FLAG_BY_SCOPE = {
    [BOARD_TABLE_SCOPE.ADMIN]: "can_admin_bulk_actions",
    [BOARD_TABLE_SCOPE.AGENT]: "can_agent_bulk_actions",
};

export const useBoardResourceTableFlags = (boardConfig, boardId, scope) => {
    const hasGroupedRecords = useMemo(() => {
        if (!boardConfig) return false;
        const hasGroupByColumn = boardConfig?.columns?.some((column) => column.group_by);
        const hasHavingCondition = Boolean(boardConfig?.havings?.length);
        return hasGroupByColumn || hasHavingCondition;
    }, [boardConfig]);

    const showDeleteAction = useMemo(
        () =>
            Boolean(
                boardConfig?.primary_entity?.startsWith("aux_") &&
                !hasGroupedRecords &&
                boardConfig?.[DELETE_FLAG_BY_SCOPE[scope]] === true,
            ),
        [boardConfig, hasGroupedRecords, scope],
    );

    const showCasesBulk = useMemo(
        () =>
            isCasesLikeEntity(boardConfig?.primary_entity) &&
            !hasGroupedRecords &&
            boardConfig?.[BULK_FLAG_BY_SCOPE[scope]] === true &&
            Boolean(boardId),
        [boardConfig, hasGroupedRecords, boardId, scope],
    );

    const showBulkDelete = showDeleteAction;

    return { hasGroupedRecords, showDeleteAction, showCasesBulk, showBulkDelete };
};
