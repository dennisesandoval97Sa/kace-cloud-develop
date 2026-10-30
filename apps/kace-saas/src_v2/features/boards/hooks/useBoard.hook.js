import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchBoard, fetchBoardResources, fetchUsersByIds } from "@kace_v2/features/boards/services/boards.service";
import { useCallback, useMemo, useState } from "react";
import useBoardsMutation from "@kace_v2/features/boards/hooks/useBoardsMutation.hook";
import Swal from "sweetalert2";
import useUserInformation from "@kace/hooks/useUserInformation";
import { MODULES } from "@kace_v2/shared/constants/modules.contants";
import useSearch from "@kace_v2/shared/hooks/useSearch.hook";
import useBoardTableState from "@kace_v2/features/boards/hooks/useBoardTableState.hook";
import { BOARD_TABLE_SCOPE } from "@kace_v2/features/boards/constants/boardTableScope.constants";
import { BOARDS_FETCH_CONFIG } from "../constants/boards.constants";
import { downloadBoardExport } from "../utils/downloadBoardExport.util";
import { useTranslation } from "react-i18next";
import { boardReturnStateTo } from "@kace_v2/features/boards/hooks/useBoardFormReturn.hook";

const useBoard = () => {
    const { id } = useParams();
    const { pathname } = useLocation();
    const { deleteBoard } = useBoardsMutation();
    const navigate = useNavigate();
    const { permissionsAdmin } = useUserInformation();
    const { t } = useTranslation();

    const [isDownloading, setIsDownloading] = useState(false);
    /*
     * Se activa al confirmar el borrado y desactiva las queries del tablero. useGeneralDelete
     * invalida ["boards"] en su onSettled, que corre antes de los callbacks pasados a mutate
     * (query-core: `await this.options.onSettled` precede al dispatch "success" que los dispara),
     * asi que navegar en onSuccess llega tarde para evitar el refetch. invalidateQueries solo
     * refetchea queries activas -- Query.isActive() exige algun observador con enabled !== false --
     * de modo que deshabilitarlas antes del DELETE es lo que impide pedir un tablero ya borrado.
     */
    const [isDeleting, setIsDeleting] = useState(false);
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
    } = useBoardTableState(id, { scope: BOARD_TABLE_SCOPE.ADMIN });

    const isUpdate = useMemo(() => pathname.includes("/boards/update"), [pathname]);

    const config = useQuery({
        queryKey: QUERY_KEYS.BOARDS.DETAILS(id),
        queryFn: () => fetchBoard(id),
        enabled: Boolean(id) && !isDeleting,
        staleTime: 0,
        gcTime: 0,
    });

    const usersByIds = useQuery({
        queryKey: QUERY_KEYS.USERS.BY_IDS(config?.data?.access_users),
        queryFn: () => fetchUsersByIds(config?.data?.access_users),
        enabled: Boolean(config?.data?.access_users?.length),
    });

    const resources = useSearch({
        queryKey: QUERY_KEYS.BOARDS.RESOURCES(id, page, criteriaWithSort),
        criteria: criteriaWithSort,
        queryFn: () => fetchBoardResources(id, page, criteriaWithSort ?? {}),
        enabled: Boolean(id) && !isUpdate && !isDeleting,
        staleTime: 0,
        gcTime: 0,
        refetchInterval: BOARDS_FETCH_CONFIG.REFETCH_INTERVAL,
    });

    const { hasUpdate, hasDelete, hasExport, hasBoardsCreateRegister, hasBoardsReadRegister, hasBoardsUpdateRegister } =
        useMemo(() => {
            const boardsPermissions = permissionsAdmin.filter(
                (permission) => permission.module_id === MODULES.BOARDS.ID,
            );

            const hasUpdate = boardsPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.UPDATE && permission.granted,
            );
            const hasDelete = boardsPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.DELETE && permission.granted,
            );
            const hasExport = boardsPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.EXPORT && permission.granted,
            );
            const hasBoardsCreateRegister = boardsPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.CREATE_REGISTER && permission.granted,
            );
            const hasBoardsReadRegister = boardsPermissions.find(
                (permission) => permission.name === MODULES.BOARDS.PERMISSIONS.READ_REGISTER && permission.granted,
            );
            const hasBoardsUpdateRegister = boardsPermissions.find(
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
        }, [permissionsAdmin]);

    const boardConfig = useMemo(() => config?.data ?? null, [config]);

    const usersCatalog = useMemo(() => {
        if (!usersByIds?.data?.data?.data?.items) return [];

        return usersByIds.data.data.data.items.map((user) => {
            const fullName = `${user.nombres ?? ""} ${user.apellido1 ?? ""} ${user.apellido2 ?? ""}`.trim();
            return {
                id: user.id,
                label: fullName,
                value: user.id,
            };
        });
    }, [usersByIds?.data]);

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

    // El formulario vuelve a donde estaba el usuario; desde aqui, a los registros del tablero.
    const updateBoard = useCallback(
        () => navigate(`/boards/update/${id}`, boardReturnStateTo(`/boards/${id}`)),
        [navigate, id],
    );

    /*
     * Ruta fija y no `navigate(-1)`: a la vista de un tablero se puede llegar desde el
     * formulario de alta, asi que el historial no siempre tiene detras el listado.
     */
    const goToBoardsList = useCallback(() => navigate("/boards"), [navigate]);

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

    const handleDelete = useCallback(() => {
        Swal.fire({
            title: t("app.modals.sure"),
            text: t("app.modals.action"),
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: t("app.forms.delete"),
            cancelButtonText: t("app.forms.cancel"),
        }).then((result) => {
            if (!result.isConfirmed) return;
            // Desactiva DETAILS/RESOURCES antes de disparar el DELETE (ver isDeleting arriba).
            setIsDeleting(true);
            /*
             * El feedback de resultado lo emiten los toast de useGeneralDelete (successMessage/
             * errorMessage), que viven a nivel de mutacion y siempre disparan. Estos callbacks no:
             * mutationObserver corta en `if (!this.hasListeners()) return`, asi que se pierden si el
             * usuario navega fuera con el DELETE en vuelo. Por eso aqui solo va navegacion y revertir
             * el estado.
             */
            deleteBoard(id, {
                onSuccess: () => {
                    /*
                     * El listado es una pagina normal y useGeneralDelete ya invalida su query, asi
                     * que basta con navegar (ademas "/" redirige a /auth).
                     */
                    navigate("/boards");
                },
                onError: () => {
                    // Re-habilita las queries: la invalidacion ya las marco stale, asi que refrescan solas.
                    setIsDeleting(false);
                },
            });
        });
    }, [deleteBoard, id, t, navigate]);

    const handleDownloadBoard = async () => {
        setIsDownloading(true);
        try {
            await downloadBoardExport(id, criteriaWithSort ?? criteria, t);
        } finally {
            setIsDownloading(false);
        }
    };

    return {
        config,
        resources,
        boardConfig,
        usersCatalog,
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
        updateBoard,
        goToBoardsList,
        handleDelete,
        handleFilter,
        handleSort,
        clearFilters,
        setOpenFilterModal,
        handleDownloadBoard,
    };
};

export default useBoard;
