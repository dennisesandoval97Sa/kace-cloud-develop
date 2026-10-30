import React, { useEffect, useMemo, useRef, useState } from "react";
import DataTable from "@kace_v2/shared/ui/organisms/DataTable";
import useUserInformation from "@/hooks/useUserInformation";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import useBoardsTriggerOptions from "@kace_v2/features/boards/hooks/useBoardsTriggerOptions.hook";
import DataTablePagination from "@kace_v2/shared/ui/organisms/DataTablePagination";
import Button from "@kace_v2/shared/ui/atoms/Button";
import DataTableFilterModal from "@kace_v2/shared/ui/molecules/DataTableFilterModal";
import BoardsOneScriptModal from "@kace_v2/features/boards/components/BoardsOneScriptModal";
import BoardsCustomFilterModal from "@kace_v2/features/boards/components/BoardsCustomFilterModal";
import { useBoardCustomFilter } from "@kace_v2/features/boards/hooks/useBoardCustomFilter.hook";
import { Plus, Eye, Filter, Loader2, RefreshCw } from "lucide-react";
import useBoardById from "../hooks/useBoardById.hook";
import useBoardCasesSelection from "@kace_v2/features/boards/hooks/useBoardCasesSelection.hook";
import BoardCasesBulkToolbar from "@kace_v2/features/boards/components/BoardCasesBulkToolbar";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { CaseStatusCounter, Button as ButtonUI } from "@/components/ui-shared";
import { CaseStatusCounterModal } from "@/components/ui-shared/src/components/table-component/CaseStatusCounterModal";
import Tooltip from "@kace_v2/shared/ui/molecules/Tooltip";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { Download } from "lucide-react";
import { getBoardContrastColor } from "@kace_v2/features/boards/utils/boardContrastColor.util";
import { BOARD_TABLE_SCOPE } from "@kace_v2/features/boards/constants/boardTableScope.constants";
import { useBoardResourceTableFlags } from "@kace_v2/features/boards/hooks/useBoardResourceTableFlags.hook";
import { useBoardDataTableColumns } from "@kace_v2/features/boards/hooks/useBoardDataTableColumns.hook";
import { useBoardDataTableRows } from "@kace_v2/features/boards/hooks/useBoardDataTableRows.hook";
import { useBoardResourceActions } from "@kace_v2/features/boards/hooks/useBoardResourceActions.hook";
import useQuickAnsFilter from "@kace_v2/features/boards/hooks/useQuickAnsFilter.hook";
import QuickAnsFilterButtons from "@kace_v2/features/boards/components/QuickAnsFilterButtons";
import ActiveFilterChips from "@kace_v2/shared/ui/molecules/ActiveFilterChips";
import useBoardVisibility from "../hooks/useBoardVisibility.hook";
import { BOARDS_FETCH_CONFIG } from "@kace_v2/features/boards/constants/boards.constants";
import { inferIsStatusColumn } from "@kace_v2/features/boards/utils/boardStatusColumn.util";
import { formatColumnLabel } from "@kace_v2/shared/utils/format-column-label.util";
import { sanitizeFilterFormValues } from "@kace_v2/features/boards/utils/sanitizeFilterFormValues.util";

const MAX_VISIBLE_COUNTERS = 4;

const BoardDetail = ({ boardId, isExpanded = false }) => {
    const { permissionsAuxiliaries } = useUserInformation();
    const { cases: configCases } = useConfigAgentData();
    const { isVisible, contentRef } = useBoardVisibility(isExpanded);

    const refetchInterval = useMemo(
        () => (isExpanded && isVisible ? BOARDS_FETCH_CONFIG.REFETCH_INTERVAL : false),
        [isExpanded, isVisible],
    );

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
        openFilterModal,
        sortConfig,
        filterFormValues,
        hasExport,
        isDownloading,
        hasBoardsCreateRegister,
        hasBoardsReadRegister,
        hasBoardsUpdateRegister,
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
    } = useBoardById(boardId, { refetchInterval });
    const { oneScriptId, showOSModal, selectedEntity, triggerOption, setShowOSModal } = useBoardsTriggerOptions();

    const { selectedIds, selectedRows, toggleRow, togglePage, clearSelection } = useBoardCasesSelection(
        boardResources,
        boardId,
        criteria,
    );
    const { t } = useTranslation();
    const [caseStatusModalOpen, setCaseStatusModalOpen] = useState(false);
    const { openCustomFilterModal, setOpenCustomFilterModal, hasCustomFilter, handleCustomFilter } =
        useBoardCustomFilter(boardConfig, handleFilter);

    const caseStatusCounter = useMemo(() => {
        const countByStatus = resources?.data?.metadata?.countByStatus || [];
        return countByStatus.map((item) => ({
            title: item?.status || "Desconocido",
            number: item?.count || 0,
            color: item?.color ?? null,
        }));
    }, [resources?.data?.metadata]);

    const countByAns = useMemo(() => resources?.data?.metadata?.countByAns ?? null, [resources?.data?.metadata]);

    const visibleCounters = caseStatusCounter?.slice(0, MAX_VISIBLE_COUNTERS) ?? [];
    const hasMoreCounters = caseStatusCounter?.length > MAX_VISIBLE_COUNTERS;

    const { hasGroupedRecords, showDeleteAction, showCasesBulk, showBulkDelete } = useBoardResourceTableFlags(
        boardConfig,
        boardId,
        BOARD_TABLE_SCOPE.AGENT,
    );
    const showBulkToolbar = showCasesBulk || showBulkDelete;

    const showCounters = Boolean(
        boardConfig?.primary_entity === "cases" && !hasGroupedRecords && caseStatusCounter?.length > 0,
    );

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
        scope: BOARD_TABLE_SCOPE.AGENT,
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
     * con lo que el agente ve en el modal y en los chips: se reaplica una sola vez
     * con lo que sigue siendo valido.
     */
    const didReapplySanitizedRef = useRef(false);
    useEffect(() => {
        if (didReapplySanitizedRef.current) return;
        if (sanitizedFilterFormValues === filterFormValues) return;
        didReapplySanitizedRef.current = true;
        handleFilter(Object.values(sanitizedFilterFormValues), sanitizedFilterFormValues);
    }, [sanitizedFilterFormValues, filterFormValues, handleFilter]);

    if (!boardId) return null;

    return (
        <div className="flex flex-col gap-2">
            <BoardsOneScriptModal
                title={t("boards.boardView.formModalTitle")}
                open={showOSModal}
                onOpenChange={setShowOSModal}
                oneScriptId={oneScriptId}
                entity_id={selectedEntity}
                primary_entity={boardConfig?.primary_entity}
                role={"agente"}
                board_id={boardConfig?.id}
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
            <div ref={contentRef} className="flex flex-col gap-2 w-full">
                <div
                    className={cn(
                        "flex w-full min-w-0 gap-3 sm:gap-2",
                        !showCounters
                            ? "flex-row items-center justify-between"
                            : "flex-col sm:flex-row sm:items-center",
                    )}
                    id="board_detail_header"
                    data-testid="board_detail_header"
                >
                    <div
                        className={cn(
                            "flex gap-2 items-center shrink-0 flex-wrap order-1",
                            showCounters ? "justify-center sm:justify-start w-full sm:w-auto" : "",
                        )}
                    >
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
                        <Button size="icon" variant="outline" onClick={resources.refetch} title="Actualizar tabla">
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
                        {showCounters && (
                            <Tooltip content={hasGroupedRecords ? t("boards.boardView.groupedViewTooltip") : ""}>
                                <div
                                    className={cn("sm:hidden shrink-0", {
                                        "cursor-not-allowed": hasGroupedRecords,
                                    })}
                                >
                                    <Button
                                        variant="secondary"
                                        onClick={() => triggerOption("ONESCRIPT", boardConfig.onescript_form_id)}
                                        disabled={hasGroupedRecords}
                                        title={t("boards.boardView.createRecord")}
                                        className="flex items-center gap-2"
                                    >
                                        <Plus className="w-5 h-5 shrink-0" />
                                    </Button>
                                </div>
                            </Tooltip>
                        )}
                    </div>

                    <div className={cn("flex items-center gap-2 shrink-0 order-3", { "hidden sm:flex": showCounters })}>
                        {hasBoardsCreateRegister &&
                            boardConfig?.can_create_record !== false &&
                            (hasGroupedRecords ? (
                                <Tooltip content={t("boards.boardView.groupedViewTooltip")}>
                                    <div className="shrink-0 cursor-not-allowed">
                                        <Button
                                            variant="secondary"
                                            onClick={() => triggerOption("ONESCRIPT", boardConfig.onescript_form_id)}
                                            disabled={hasGroupedRecords}
                                            title={t("boards.boardView.createRecord")}
                                            className="flex items-center gap-2"
                                        >
                                            <Plus className="w-5 h-5 shrink-0" />
                                            <span className="hidden sm:inline">
                                                {t("boards.boardView.createRecord")}
                                            </span>
                                        </Button>
                                    </div>
                                </Tooltip>
                            ) : (
                                <div className="shrink-0">
                                    <Button
                                        variant="secondary"
                                        onClick={() => triggerOption("ONESCRIPT", boardConfig.onescript_form_id)}
                                        title={t("boards.boardView.createRecord")}
                                        className="flex items-center gap-2"
                                    >
                                        <Plus className="w-5 h-5 shrink-0" />
                                        <span className="hidden sm:inline">{t("boards.boardView.createRecord")}</span>
                                    </Button>
                                </div>
                            ))}
                        {hasExport && (
                            <Button size="icon" onClick={handleDownloadBoard} className="ml-0" disabled={isDownloading}>
                                {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
                            </Button>
                        )}
                    </div>

                    {showCounters && (
                        <div
                            className="flex gap-2 flex-wrap items-center justify-center sm:flex-1 min-w-0 order-2"
                            id="board_detail_case_status_counter"
                            data-testid="board_detail_case_status_counter"
                        >
                            {visibleCounters.map((item, index) => (
                                <div key={`board_case_status_counter_${index}`} className="shrink-0">
                                    <CaseStatusCounter
                                        title={item.title}
                                        number={item.number}
                                        icon={item.icon}
                                        color={item.color}
                                    />
                                </div>
                            ))}
                            {hasMoreCounters && (
                                <CaseStatusCounterModal
                                    open={caseStatusModalOpen}
                                    onOpenChange={setCaseStatusModalOpen}
                                    caseStatusCounter={caseStatusCounter}
                                    trigger={
                                        <ButtonUI
                                            variant="ghost"
                                            size="sm"
                                            className="shrink-0 self-center hover:bg-transparent hover:text-primary"
                                            id="board_detail_case_status_ver_mas"
                                            data-testid="board_detail_case_status_ver_mas"
                                        >
                                            <Eye className="w-5 h-5 sm:mr-2 shrink-0" />
                                            <span className="hidden sm:inline">{t("gridMain.text.verMas")}</span>
                                        </ButtonUI>
                                    }
                                />
                            )}
                        </div>
                    )}
                </div>
                {showBulkToolbar && (
                    <BoardCasesBulkToolbar
                        boardId={boardId}
                        boardConfig={boardConfig}
                        selectedIds={selectedIds}
                        selectedRows={selectedRows}
                        clearSelection={clearSelection}
                        permissionScope="agent"
                        showBulkDelete={showBulkDelete}
                        permissionsAuxiliaries={permissionsAuxiliaries}
                    />
                )}
                <div className="w-full overflow-x-auto">
                    <DataTable
                        columns={columns}
                        actions={actions}
                        rows={rows}
                        isLoading={resources.isLoading || resources.isFetching}
                        isError={resources.isError}
                        handlerError={resources.refetch}
                        selectable={showBulkToolbar}
                        selection={selectedIds}
                        onToggleRow={toggleRow}
                        onTogglePage={togglePage}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                    />
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
        </div>
    );
};

BoardDetail.propTypes = {
    boardId: PropTypes.string.isRequired,
    isExpanded: PropTypes.bool,
};

export default BoardDetail;
