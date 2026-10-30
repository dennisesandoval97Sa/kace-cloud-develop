import React, { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import useUserInformation from "@/hooks/useUserInformation";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import useBoard from "@kace_v2/features/boards/hooks/useBoard.hook";
import useBoardCasesSelection from "@kace_v2/features/boards/hooks/useBoardCasesSelection.hook";
import BoardCasesBulkToolbar from "@kace_v2/features/boards/components/BoardCasesBulkToolbar";
import DataTable from "@kace_v2/shared/ui/organisms/DataTable";
import useBoardsTriggerOptions from "@kace_v2/features/boards/hooks/useBoardsTriggerOptions.hook";
import useBoardRecordSavedListener from "@kace_v2/features/boards/hooks/useBoardRecordSavedListener.hook";
import DataTablePagination from "@kace_v2/shared/ui/organisms/DataTablePagination";
import Button from "@kace_v2/shared/ui/atoms/Button";
import DataTableFilterModal from "@kace_v2/shared/ui/molecules/DataTableFilterModal";
import BoardsOneScriptModal from "@kace_v2/features/boards/components/BoardsOneScriptModal";
import BoardsCustomFilterModal from "@kace_v2/features/boards/components/BoardsCustomFilterModal";
import { useBoardCustomFilter } from "@kace_v2/features/boards/hooks/useBoardCustomFilter.hook";
import { Plus, Download, Filter, RefreshCw, Loader2, ChevronLeft } from "lucide-react";
import Tooltip from "@kace_v2/shared/ui/molecules/Tooltip";
import { findPublicErrorCode, PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { getBoardContrastColor } from "@kace_v2/features/boards/utils/boardContrastColor.util";
import { BOARD_TABLE_SCOPE } from "@kace_v2/features/boards/constants/boardTableScope.constants";
import { useBoardResourceTableFlags } from "@kace_v2/features/boards/hooks/useBoardResourceTableFlags.hook";
import { useBoardDataTableColumns } from "@kace_v2/features/boards/hooks/useBoardDataTableColumns.hook";
import { useBoardDataTableRows } from "@kace_v2/features/boards/hooks/useBoardDataTableRows.hook";
import { useBoardResourceActions } from "@kace_v2/features/boards/hooks/useBoardResourceActions.hook";
import useQuickAnsFilter from "@kace_v2/features/boards/hooks/useQuickAnsFilter.hook";
import QuickAnsFilterButtons from "@kace_v2/features/boards/components/QuickAnsFilterButtons";
import ActiveFilterChips from "@kace_v2/shared/ui/molecules/ActiveFilterChips";
import { inferIsStatusColumn } from "@kace_v2/features/boards/utils/boardStatusColumn.util";
import { formatColumnLabel } from "@kace_v2/shared/utils/format-column-label.util";
import { sanitizeFilterFormValues } from "@kace_v2/features/boards/utils/sanitizeFilterFormValues.util";

const BoardsResources = () => {
    const { t } = useTranslation();
    const { permissionsAuxiliaries } = useUserInformation();
    const { cases: configCases } = useConfigAgentData();
    const { id: boardId } = useParams();
    const {
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
        isDownloading,
        hasBoardsCreateRegister,
        hasBoardsReadRegister,
        hasBoardsUpdateRegister,
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
    } = useBoard();

    const countByAns = useMemo(() => resources?.data?.metadata?.countByAns ?? null, [resources?.data?.metadata]);

    const { oneScriptId, showOSModal, selectedEntity, setSelectedEntity, triggerOption, setShowOSModal } =
        useBoardsTriggerOptions();

    const { openCustomFilterModal, setOpenCustomFilterModal, hasCustomFilter, handleCustomFilter } =
        useBoardCustomFilter(boardConfig, handleFilter);

    const resourceErrorCode = findPublicErrorCode(
        resources.error?.response?.data?.data?.code,
        resources.error?.response?.data?.code,
    );
    const isMissingActiveGroup =
        resources.isError &&
        (resourceErrorCode === PUBLIC_ERROR_CODES.BOARD_REQUIRES_ACTIVE_GROUP ||
            // TODO(KTSS-3213-followup): remove legacy message fallback after production consistently emits BOARD_REQUIRES_ACTIVE_GROUP.
            resources.error?.response?.data?.message === "board_requires_active_group");

    useBoardRecordSavedListener(setSelectedEntity);

    const { selectedIds, selectedRows, toggleRow, togglePage, clearSelection } = useBoardCasesSelection(
        boardResources,
        boardId,
        criteria,
    );

    const { hasGroupedRecords, showDeleteAction, showCasesBulk, showBulkDelete } = useBoardResourceTableFlags(
        boardConfig,
        boardId,
        BOARD_TABLE_SCOPE.ADMIN,
    );
    const showBulkToolbar = showCasesBulk || showBulkDelete;

    const columns = useBoardDataTableColumns(boardConfig, showDeleteAction);

    const { ansItems, quickAnsFilter, activeAnsValue, applyQuickAnsFilter, handleModalFilter } = useQuickAnsFilter({
        boardConfig,
        criteria,
        handleFilter,
        clearFilters,
    });

    const rows = useBoardDataTableRows(
        boardConfig,
        boardResources,
        getBoardContrastColor,
        ansItems,
        configCases?.show_time_description_prefixes ?? true,
    );

    const actions = useBoardResourceActions({
        boardConfig,
        hasGroupedRecords,
        hasBoardsReadRegister,
        hasBoardsUpdateRegister,
        showDeleteAction,
        permissionsAuxiliaries,
        refetchResources: resources.refetch,
        triggerOption,
        scope: BOARD_TABLE_SCOPE.ADMIN,
    });

    const filtersFields = useMemo(() => {
        if (!boardConfig?.columns) return [];

        return boardConfig.columns
            .filter((column) => column.is_filterable)
            .map((column, index) => {
                const isStatus = inferIsStatusColumn(column);
                const rawLabel = column.alias || column.field || `Campo ${index + 1}`;
                return {
                    type: isStatus ? "boolean" : column.data_type.toLowerCase(),
                    value: "",
                    label: formatColumnLabel(rawLabel),
                    name: column.alias || String(column.field ?? "").replaceAll(".", "_"),
                    field: column.field,
                    entity: column.entity,
                    function: column.function,
                    alias: column.alias,
                    ...(isStatus
                        ? {
                              booleanActiveLabel: t("boards.boardView.status.active", { defaultValue: "Activo" }),
                              booleanInactiveLabel: t("boards.boardView.status.inactive", {
                                  defaultValue: "Inactivo",
                              }),
                          }
                        : {}),
                };
            });
    }, [boardConfig, t]);

    const sanitizedFilterFormValues = useMemo(
        () => sanitizeFilterFormValues(filterFormValues, filtersFields),
        [filterFormValues, filtersFields],
    );

    /*
     * Si el saneo descarto algun campo, el criterio ejecutado dejaria de coincidir
     * con lo que se ve en el modal y en los chips: se reaplica una sola vez con lo
     * que sigue siendo valido.
     *
     * "Una vez" es por tablero, no por montaje: la ruta /boards/:id cambia el id
     * sin desmontar (misma razon por la que useBoardTableState rehidrata en un
     * efecto), asi que el ref se reinicia al cambiar de tablero.
     */
    const didReapplySanitizedRef = useRef(false);
    const previousBoardIdRef = useRef(boardId);
    if (previousBoardIdRef.current !== boardId) {
        previousBoardIdRef.current = boardId;
        didReapplySanitizedRef.current = false;
    }
    useEffect(() => {
        if (didReapplySanitizedRef.current) return;
        if (sanitizedFilterFormValues === filterFormValues) return;
        didReapplySanitizedRef.current = true;
        handleFilter(Object.values(sanitizedFilterFormValues), sanitizedFilterFormValues);
    }, [sanitizedFilterFormValues, filterFormValues, handleFilter]);

    return (
        <DashboardSectionCard title={boardConfig?.name ?? t("boards.boardView.defaultBoardTitle")}>
            <BoardsOneScriptModal
                title={t("boards.boardView.formModalTitle")}
                open={showOSModal}
                onOpenChange={setShowOSModal}
                oneScriptId={oneScriptId}
                entity_id={selectedEntity}
                primary_entity={boardConfig?.primary_entity}
                board_id={boardConfig?.id}
                role={"administrador"}
            />
            {hasCustomFilter && (
                <BoardsCustomFilterModal
                    title={t("boards.boardView.customFilterTitle")}
                    description={t("boards.boardView.customFilterDescription")}
                    open={openCustomFilterModal}
                    onOpenChange={setOpenCustomFilterModal}
                    oneScriptId={boardConfig?.filter_onescript_id}
                    board_id={boardConfig?.id}
                    onFilter={handleCustomFilter}
                />
            )}
            <div className="flex flex-col gap-2">
                <div className="w-full flex justify-between items-center">
                    <div className="flex gap-2">
                        <Button
                            size="icon"
                            variant="outline"
                            type="button"
                            onClick={goToBoardsList}
                            title={t("boards.boardView.backToList")}
                            id="btn_back_boards_resources"
                            data-testid="btn_back_boards_resources"
                        >
                            <ChevronLeft />
                        </Button>
                        {hasCustomFilter ? (
                            <Button size="icon" variant="outline" onClick={() => setOpenCustomFilterModal(true)}>
                                <Filter />
                            </Button>
                        ) : (
                            <DataTableFilterModal
                                title={t("boards.boardView.filtersTitle")}
                                description={t("boards.boardView.filtersDescription")}
                                submitLabel={t("boards.boardView.filterSubmit")}
                                open={openFilterModal}
                                onOpenChange={setOpenFilterModal}
                                fields={filtersFields}
                                initialValues={sanitizedFilterFormValues}
                                onSubmit={handleModalFilter}
                            />
                        )}
                        <Button
                            size="icon"
                            variant="outline"
                            onClick={resources.refetch}
                            title={t("boards.boardView.refreshTable")}
                        >
                            <RefreshCw />
                        </Button>
                        <QuickAnsFilterButtons
                            quickAnsFilter={quickAnsFilter}
                            activeAnsValue={activeAnsValue}
                            applyQuickAnsFilter={applyQuickAnsFilter}
                            countByAns={countByAns}
                        />
                        {Array.isArray(criteria?.filter) && criteria.filter.length > 0 && (
                            <>
                                <Button variant="outline" onClick={clearFilters}>
                                    {t("boards.boardView.clearFilters")}
                                </Button>
                                <ActiveFilterChips criteria={criteria} columns={boardConfig?.columns} />
                            </>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {hasBoardsCreateRegister &&
                            boardConfig?.can_create_record !== false &&
                            (hasGroupedRecords ? (
                                <Tooltip content={t("boards.boardView.groupedViewTooltip")}>
                                    <div className="cursor-not-allowed">
                                        <Button
                                            variant="secondary"
                                            onClick={() => triggerOption("ONESCRIPT", boardConfig.onescript_form_id)}
                                            disabled
                                        >
                                            <Plus />
                                            {t("boards.boardView.createRecord")}
                                        </Button>
                                    </div>
                                </Tooltip>
                            ) : (
                                <div>
                                    <Button
                                        variant="secondary"
                                        onClick={() => triggerOption("ONESCRIPT", boardConfig.onescript_form_id)}
                                    >
                                        <Plus />
                                        {t("boards.boardView.createRecord")}
                                    </Button>
                                </div>
                            ))}
                        {hasUpdate && <Button onClick={updateBoard}>{t("boards.boardView.updateBoard")}</Button>}
                        {hasDelete && (
                            <Button variant="destructive" onClick={handleDelete}>
                                {t("boards.boardView.deleteBoard")}
                            </Button>
                        )}

                        {hasExport && (
                            <Button size="icon" onClick={handleDownloadBoard} disabled={isDownloading}>
                                {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
                            </Button>
                        )}
                    </div>
                </div>
                {showBulkToolbar && (
                    <BoardCasesBulkToolbar
                        boardId={boardId}
                        boardConfig={boardConfig}
                        selectedIds={selectedIds}
                        selectedRows={selectedRows}
                        clearSelection={clearSelection}
                        permissionScope="admin"
                        showBulkDelete={showBulkDelete}
                        permissionsAuxiliaries={permissionsAuxiliaries}
                    />
                )}
                <div className="w-full overflow-x-auto">
                    {isMissingActiveGroup ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                            <p className="text-sm font-medium">{t("boards.errors.requiresActiveGroup")}</p>
                            <p className="text-xs">{t("boards.errors.requiresActiveGroupHint")}</p>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            actions={actions}
                            rows={rows}
                            isLoading={resources.isLoading || resources.isFetching}
                            isError={resources.isError}
                            handlerError={resources.refetch}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            selectable={showBulkToolbar}
                            selection={selectedIds}
                            onToggleRow={toggleRow}
                            onTogglePage={togglePage}
                        />
                    )}
                </div>
                <DataTablePagination
                    page={page}
                    totalPages={totalPages}
                    totalRecords={totalRecords}
                    onFirstPage={onFirstPage}
                    onPreviousPage={onPreviousPage}
                    onGoToPage={onGoToPage}
                    onNextPage={onNextPage}
                    onLastPage={onLastPage}
                    canNextPage={canNextPage}
                    canPreviousPage={canPreviousPage}
                    isFetching={resources.isFetching}
                />
            </div>
        </DashboardSectionCard>
    );
};

export default BoardsResources;
