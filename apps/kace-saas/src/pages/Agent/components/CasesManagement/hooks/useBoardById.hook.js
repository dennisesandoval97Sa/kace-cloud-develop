import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchBoard, fetchBoardResources } from "@kace_v2/features/boards/services/boards.service";
import { downloadBoardExport } from "@kace_v2/features/boards/utils/downloadBoardExport.util";
import { useCallback, useMemo, useState } from "react";
import useUserInformation from "@kace/hooks/useUserInformation";
import { MODULES } from "@kace_v2/shared/constants/modules.contants";
import useSearch from "@kace_v2/shared/hooks/useSearch.hook";
import useBoardTableState from "@kace_v2/features/boards/hooks/useBoardTableState.hook";
import { BOARD_TABLE_SCOPE } from "@kace_v2/features/boards/constants/boardTableScope.constants";
import { useTranslation } from "react-i18next";
import { useLoadedAgentClientId } from "./useLoadedAgentClientId";

const useBoardById = (boardId, options = {}) => {
    const { permissionsAdmin, permissionsAgent } = useUserInformation();
    const { t } = useTranslation();

    const [isDownloading, setIsDownloading] = useState(false);
    const {
        page,
        setPage,
        criteria,
        criteriaWithSort,
        filterFormValues,
        sortConfig,
        openFilterModal,
        setOpenFilterModal,
        handleFilter,
        handleSort,
        clearFilters,
    } = useBoardTableState(boardId, { scope: BOARD_TABLE_SCOPE.AGENT });
    const activeClientId = useLoadedAgentClientId();

    const config = useQuery({
        queryKey: QUERY_KEYS.BOARDS.DETAILS(boardId),
        queryFn: () => fetchBoard(boardId),
        enabled: Boolean(boardId),
        staleTime: 0,
        gcTime: 0,
    });

    const resources = useSearch({
        queryKey: QUERY_KEYS.BOARDS.RESOURCES(boardId, page, criteriaWithSort, activeClientId),
        criteria: criteriaWithSort,
        queryFn: () => fetchBoardResources(boardId, page, criteriaWithSort ?? {}, activeClientId),
        enabled: Boolean(boardId),
        placeholderData: (previousData) => previousData,
        staleTime: 0,
        gcTime: 0,
        refetchInterval: options?.refetchInterval ?? false,
    });

    const { hasUpdate, hasDelete, hasExport, hasBoardsCreateRegister, hasBoardsReadRegister, hasBoardsUpdateRegister } =
        useMemo(() => {
            const boardsPermissions = permissionsAdmin.filter(
                (permission) => permission.module_id === MODULES.BOARDS.ID,
            );
            const boardsAgentPermissions = permissionsAgent.filter(
                (permission) => permission.module_id === MODULES.BOARDS.ID,
            );

            const hasUpdate = boardsPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.UPDATE && permission.granted,
            );
            const hasDelete = boardsPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.DELETE && permission.granted,
            );
            const hasExport = boardsAgentPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.EXPORT && permission.granted,
            );
            const hasBoardsCreateRegister = boardsAgentPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.CREATE_REGISTER && permission.granted,
            );
            const hasBoardsReadRegister = boardsAgentPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.READ_REGISTER && permission.granted,
            );
            const hasBoardsUpdateRegister = boardsAgentPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.UPDATE_REGISTER && permission.granted,
            );
            return {
                hasUpdate,
                hasDelete,
                hasExport,
                hasBoardsCreateRegister,
                hasBoardsReadRegister,
                hasBoardsUpdateRegister,
            };
        }, [permissionsAdmin, permissionsAgent]);

    const boardConfig = useMemo(() => config?.data ?? null, [config]);

    const boardResources = useMemo(() => resources?.data?.data?.items ?? [], [resources]);

    const metadataTotalPages = useMemo(() => {
        const m = resources?.data?.metadata ?? {};
        const parsedTotalPages = Number(m.total_pages ?? m.totalPages);
        return Number.isFinite(parsedTotalPages) && parsedTotalPages > 0 ? parsedTotalPages : null;
    }, [resources?.data?.metadata]);

    const totalPages = useMemo(() => {
        if (metadataTotalPages !== null) return metadataTotalPages;
        return Math.max(1, page);
    }, [metadataTotalPages, page]);
    const totalRecords = useMemo(() => {
        const metadata = resources?.data?.metadata ?? {};
        const candidates = [
            metadata.total_records,
            metadata.totalRecords,
            metadata.total_items,
            metadata.totalItems,
            metadata.total_count,
            metadata.totalCount,
            metadata.count,
        ];
        const resolvedCandidate = candidates.find((value) => Number.isFinite(Number(value)));
        return resolvedCandidate !== undefined ? Number(resolvedCandidate) : boardResources.length;
    }, [resources, boardResources.length]);

    const canNextPage = useMemo(() => {
        if (metadataTotalPages === null && boardResources.length === 0) return false;
        if (totalPages <= 1) return false;
        return page < totalPages;
    }, [page, totalPages, metadataTotalPages, boardResources.length]);

    const canPreviousPage = useMemo(() => {
        if (metadataTotalPages === null && boardResources.length === 0) return false;
        return page > 1;
    }, [page, metadataTotalPages, boardResources.length]);

    const onNextPage = useCallback(() => {
        setPage((prev) => Math.min(prev + 1, totalPages));
    }, [totalPages]);

    const onPreviousPage = useCallback(() => {
        setPage(page > 1 ? page - 1 : 1);
    }, [page]);

    const onFirstPage = useCallback(() => {
        setPage(1);
    }, []);

    const onLastPage = useCallback(() => {
        setPage(totalPages);
    }, [totalPages]);

    const onGoToPage = useCallback(
        (targetPage) => {
            const parsedTargetPage = Number(targetPage);
            if (!Number.isFinite(parsedTargetPage)) return;

            const clampedPage = Math.min(Math.max(Math.floor(parsedTargetPage), 1), totalPages);
            setPage(clampedPage);
        },
        [totalPages],
    );

    const handleDownloadBoard = async () => {
        setIsDownloading(true);
        try {
            await downloadBoardExport(boardId, criteriaWithSort ?? criteria, t, activeClientId);
        } finally {
            setIsDownloading(false);
        }
    };

    return {
        config,
        resources,
        boardConfig,
        boardResources,
        page,
        totalPages,
        totalRecords,
        criteria,
        canNextPage,
        canPreviousPage,
        hasUpdate,
        hasDelete,
        hasExport,
        hasBoardsCreateRegister,
        hasBoardsReadRegister,
        hasBoardsUpdateRegister,
        isDownloading,
        openFilterModal,
        sortConfig,
        filterFormValues,
        onNextPage,
        onPreviousPage,
        onFirstPage,
        onLastPage,
        onGoToPage,
        handleFilter,
        handleSort,
        clearFilters,
        setOpenFilterModal,
        handleDownloadBoard,
    };
};

export default useBoardById;
