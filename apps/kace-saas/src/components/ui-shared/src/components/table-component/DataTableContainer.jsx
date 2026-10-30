import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getExpandedRowModel,
} from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import PropTypes from "prop-types";
import Pagination from "./pagination";
import { Fragment, memo, useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { DataTableViewOptions } from "./data-table-view-options-props";
import { CaseStatusCounterModal } from "./CaseStatusCounterModal";
import { GeneralLoader } from "../general-loader";
import { AllButtonsFilters } from "./AllButtonsFilters";
import { useTranslation } from "react-i18next";
import { ErrorGetData } from "../../../../core/ErrorPage/ErrorGetData";
import { FilterCustomization } from "./FilterCustomization";
import { useSelector } from "react-redux";
import { CaseStatusCounter } from "../CaseStatusCounter";
import { EyeIcon } from "lucide-react";
import { SortableHeader } from "./SortableHeader";
import { getChildClassificationLevels } from "./columns";
import CellClassificationRow from "../../../../../componentsV2/core/TableCellContent/components/CellClassificationRow";
import { EXPANDED_CONTENT_TYPE } from "./expandedContentTypes";
import { getClassificationPath } from "@/utils/classificationLevels";
import { resolveSafePageIndex } from "./resolveSafePageIndex";
import { DEFAULT_FILTER_SCOPE, FILTER_SCOPES } from "./helpers";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const DEFAULT_GET_ROW_CAN_EXPAND = () => false;

function DataTableContainerBase({
    columns = EMPTY_ARRAY,
    isPagination = true,
    pageSize = 10,
    hiddenColumns = EMPTY_OBJECT,
    showFilterCases = false,
    nameHelper = EMPTY_ARRAY,
    view = EMPTY_OBJECT,
    isLoadingHeaders = false,
    getRowCanExpand = DEFAULT_GET_ROW_CAN_EXPAND,
    showFilterGeneric = true,
    dataTable = EMPTY_ARRAY,
    isLoadingTable = false,
    refresh = null,
    isFetching = false,
    errorData = false,
    columnsToFilter = EMPTY_ARRAY,
    fieldsCustomerFilters = null,
    showColumnsButton = true,
    showUpdateButton = true,
    renderSubComponent: renderSubComponentProp = null,
    autoResetPageIndex = true,
    defaultSorting = EMPTY_ARRAY,
    caseStatusCounter = EMPTY_ARRAY,
    showSubcasesButton = true,
    baseFilters = EMPTY_ARRAY,
    onClearFilters = null,
    onSort = null,
    sortConfig = null,
    getRowStyle = null,
    showColumnsDropdown = true,
    getRowId = undefined,
    scope = DEFAULT_FILTER_SCOPE,
}) {
    const [sorting, setSorting] = useState(defaultSorting ?? []);
    const [columnVisibility, setColumnVisibility] = useState(hiddenColumns);
    const [columnFilters, setColumnFilters] = useState([]);
    const [rowSelection, setRowSelection] = useState({});
    const [expanded, setExpanded] = useState({});
    const [expandedContentTypeByRowId, setExpandedContentTypeByRowId] = useState({});
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize,
    });

    // Keep the internal (client-side) pagination page size in sync with the `pageSize` prop.
    // Consumers that paginate server-side (isPagination={false}) pass their server page size here
    // so every fetched row renders; without this the row model would silently clip to the initial
    // size (default 10) even when more rows are supplied.
    useEffect(() => {
        setPagination((prev) => (prev.pageSize === pageSize ? prev : { ...prev, pageSize }));
    }, [pageSize]);

    // Cases tables keep autoResetPageIndex=false so refetchInterval does not kick users to page 0.
    // When a new filter shrinks the dataset, the previous pageIndex can fall out of range and the
    // table renders empty even though matching rows exist — snap back to the first page.
    useEffect(() => {
        const rowCount = Array.isArray(dataTable) ? dataTable.length : 0;
        setPagination((prev) => {
            const nextPageIndex = resolveSafePageIndex(prev.pageIndex, rowCount, prev.pageSize);
            return nextPageIndex === prev.pageIndex ? prev : { ...prev, pageIndex: nextPageIndex };
        });
    }, [dataTable]);

    const [caseStatusModalOpen, setCaseStatusModalOpen] = useState(false);
    const currentColor = useSelector((state) => state.filterCases.currentColor);
    const MAX_VISIBLE_COUNTERS = 4;
    const visibleCounters = caseStatusCounter?.slice(0, MAX_VISIBLE_COUNTERS) ?? [];
    const hasMoreCounters = caseStatusCounter?.length > MAX_VISIBLE_COUNTERS;

    const { t } = useTranslation();

    useEffect(() => {
        const rows = Array.isArray(dataTable) ? dataTable : [];
        const activeRowIds = new Set(rows.map((row, index) => (getRowId ? getRowId(row, index) : index.toString())));
        const pruneMissingRowIds = (currentState) => {
            if (currentState === true) return currentState;

            const nextState = Object.fromEntries(
                Object.entries(currentState).filter(([rowId]) => activeRowIds.has(rowId)),
            );

            return Object.keys(nextState).length === Object.keys(currentState).length ? currentState : nextState;
        };

        setExpanded(pruneMissingRowIds);
        setExpandedContentTypeByRowId(pruneMissingRowIds);
    }, [dataTable, getRowId]);

    const table = useReactTable({
        data: dataTable,
        columns,
        getRowId,
        defaultColumn: {
            minSize: 150,
            size: 200,
            maxSize: 300,
        },
        getRowCanExpand,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        onExpandedChange: setExpanded,
        enableRowSelection: true,
        autoResetPageIndex,
        onPaginationChange: setPagination,
        onRowSelectionChange: setRowSelection,
        meta: {
            getExpandedContentType: (rowId) => expandedContentTypeByRowId[rowId],
            setExpandedContentType: (rowId, type) =>
                setExpandedContentTypeByRowId((prev) => ({
                    ...prev,
                    [rowId]: type,
                })),
        },
        state: {
            sorting,
            columnVisibility,
            columnFilters,
            pagination,
            rowSelection,
            expanded,
        },
    });

    const renderClassificationSubComponent = useCallback(({ row }) => {
        /*
         * Classification descendants still determine expandability. The expanded panel renders the complete
         * Classification Path, while preserving descendants-only rows as a legacy compatibility fallback.
         */
        const classificationChildren =
            row.original.classificationChildren ?? getChildClassificationLevels(row.original);
        const classificationPath = getClassificationPath(row.original, classificationChildren);

        return <CellClassificationRow classifications={classificationPath} />;
    }, []);

    const renderSubComponent = useCallback(
        ({ row }) => {
            if (expandedContentTypeByRowId[row.id] === EXPANDED_CONTENT_TYPE.CLASSIFICATION) {
                return renderClassificationSubComponent({ row });
            }

            return renderSubComponentProp ? renderSubComponentProp({ row }) : renderClassificationSubComponent({ row });
        },
        [expandedContentTypeByRowId, renderClassificationSubComponent, renderSubComponentProp],
    );

    const renderHeaderRow = (filterActions = null) => (
        <div
            className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 w-full min-w-0 ${!caseStatusCounter || caseStatusCounter.length === 0 ? "sm:justify-between" : ""}`}
            id="data_table_container_header"
            data-testid="data_table_container_header"
        >
            <div className="flex gap-2 items-center shrink-0 flex-wrap justify-center sm:justify-start order-1">
                {filterActions}
                {showFilterCases && (
                    <div
                        className="flex gap-2 shrink-0"
                        id="data_table_container_filters"
                        data-testid="data_table_container_filters"
                    >
                        <AllButtonsFilters
                            isFetching={isFetching}
                            id="data_table_container_all_buttons_filters"
                            data-testid="data_table_container_all_buttons_filters"
                        />
                    </div>
                )}
                {showColumnsButton && showColumnsDropdown && (
                    <div className="sm:hidden shrink-0">
                        <DataTableViewOptions
                            table={table}
                            id="data_table_container_view_options_mobile"
                            data-testid="data_table_container_view_options_mobile"
                        />
                    </div>
                )}
            </div>
            {caseStatusCounter && caseStatusCounter.length > 0 && (
                <div
                    className="flex gap-2 flex-wrap items-center justify-center sm:flex-1 min-w-0 order-2"
                    id="data_table_container_case_status_counter"
                    data-testid="data_table_container_case_status_counter"
                >
                    {visibleCounters.map((item, index) => (
                        <div key={`case_status_counter_${index}`} className="shrink-0">
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
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 self-center hover:bg-transparent hover:text-primary"
                                    id="data_table_container_case_status_ver_mas"
                                    data-testid="data_table_container_case_status_ver_mas"
                                >
                                    <EyeIcon className="w-5 h-5 sm:mr-2 shrink-0" />
                                    <span className="hidden sm:inline">{t("gridMain.text.verMas")}</span>
                                </Button>
                            }
                        />
                    )}
                </div>
            )}
            {showColumnsButton && showColumnsDropdown && (
                <div className="hidden sm:block shrink-0 order-3" data-testid="data_table_container_header_actions">
                    <DataTableViewOptions
                        table={table}
                        id="data_table_container_view_options"
                        data-testid="data_table_container_view_options"
                    />
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-2" id="data_table_container" data-testid="data_table_container">
            {showUpdateButton || showFilterGeneric ? (
                <FilterCustomization
                    nameHelper={nameHelper}
                    nameTable={view}
                    isLoadingHeaders={isLoadingHeaders}
                    refetch={refresh}
                    isFetching={isFetching}
                    showFilterGeneric={showFilterGeneric}
                    columnsToFilter={columnsToFilter}
                    fieldsCustomerFilters={fieldsCustomerFilters}
                    baseFilters={baseFilters}
                    onClear={onClearFilters}
                    scope={scope}
                    data-testid="data_table_container_filter_customization"
                >
                    {(filterActions) => renderHeaderRow(filterActions)}
                </FilterCustomization>
            ) : (
                renderHeaderRow()
            )}
            <div className="flex flex-grow">
                <Table className="bg-background rounded-md" id="data_table" data-testid="data_table">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            id={`table_header_${header.column.id}`}
                                            data-testid={`table_header_${header.column.id}`}
                                        >
                                            {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                                <SortableHeader
                                                    direction={
                                                        onSort
                                                            ? sortConfig?.field === header.column.id
                                                                ? sortConfig.direction
                                                                : null
                                                            : header.column.getIsSorted() || null
                                                    }
                                                    onClick={
                                                        onSort
                                                            ? () => onSort(header.column.id)
                                                            : header.column.getToggleSortingHandler()
                                                    }
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                </SortableHeader>
                                            ) : (
                                                flexRender(header.column.columnDef.header, header.getContext())
                                            )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody id="data_table_container_body" data-testid="data_table_container_body">
                        {(() => {
                            if (isLoadingTable) {
                                return (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                            id="table_loader_cell"
                                            data-testid="table_loader_cell"
                                        >
                                            <GeneralLoader />
                                        </TableCell>
                                    </TableRow>
                                );
                            }

                            if (errorData) {
                                return (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                            id="table_error_cell"
                                            data-testid="table_error_cell"
                                        >
                                            <ErrorGetData refetch={refresh} />
                                        </TableCell>
                                    </TableRow>
                                );
                            }

                            const rows = table.getRowModel().rows;
                            if (!rows || rows?.length === 0) {
                                return (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                            id="table_no_results"
                                            data-testid="table_no_results"
                                        >
                                            <p>{t("gridMain.text.noResults")}</p>
                                        </TableCell>
                                    </TableRow>
                                );
                            }
                            return rows.map((row) => (
                                <Fragment key={row.id}>
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className={`${currentColor}`}
                                        style={getRowStyle ? getRowStyle(row) : {}}
                                        id={`row_${row?.original.id}`}
                                        data-testid={`row_${row?.original.id}`}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                id={`data_table_container_cell_${cell.id}`}
                                                data-testid={`data_table_container_cell_${cell.id}`}
                                            >
                                                {cell.column.columnDef.id === "select" ||
                                                cell.column.columnDef.id === "actions" ? (
                                                    flexRender(cell.column.columnDef.cell, cell.getContext())
                                                ) : (cell.column.columnDef.accessorKey === "subcasos" ||
                                                      cell.column.columnDef.isSubcasosColumn) &&
                                                  showSubcasesButton ? (
                                                    <button
                                                        type="button"
                                                        aria-label={t("gridMain.columns.subcases")}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const currentType =
                                                                table.options.meta.getExpandedContentType(row.id);
                                                            const isExpanded = row.getIsExpanded();

                                                            if (
                                                                isExpanded &&
                                                                currentType === EXPANDED_CONTENT_TYPE.SUBCASES
                                                            ) {
                                                                row.toggleExpanded(false);
                                                                return;
                                                            }

                                                            table.options.meta.setExpandedContentType(
                                                                row.id,
                                                                EXPANDED_CONTENT_TYPE.SUBCASES,
                                                            );
                                                            if (row.original.onLoadSubcases) {
                                                                row.original.onLoadSubcases();
                                                            }
                                                            if (!isExpanded) {
                                                                row.toggleExpanded(true);
                                                            }
                                                        }}
                                                        disabled={row.original.loadingSubcases}
                                                        className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60 transition-colors"
                                                    >
                                                        <span className="text-sm">
                                                            {row.getIsExpanded() ? "▼" : "▶"}
                                                        </span>
                                                    </button>
                                                ) : cell.getValue() !== null &&
                                                  cell.getValue() !== undefined &&
                                                  cell.getValue() !== "" ? (
                                                    flexRender(cell.column.columnDef.cell, cell.getContext())
                                                ) : (
                                                    <p>Sin datos</p>
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    {row.getIsExpanded() && (
                                        <tr
                                            id={`data_table_container_row_expanded_${row.id}`}
                                            data-testid={`data_table_container_row_expanded_${row.id}`}
                                        >
                                            <td colSpan={row.getVisibleCells()?.length}>
                                                {renderSubComponent({ row })}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ));
                        })()}
                    </TableBody>
                </Table>
            </div>
            {isPagination && dataTable?.length > 10 && (
                <Pagination table={table} isLoading={isLoadingTable || isFetching} />
            )}
        </div>
    );
}

DataTableContainerBase.propTypes = {
    columns: PropTypes.array.isRequired,
    isPagination: PropTypes.bool,
    pageSize: PropTypes.number,
    hiddenColumns: PropTypes.object,
    showFilterCases: PropTypes.bool,
    nameHelper: PropTypes.array,
    view: PropTypes.shape({
        url: PropTypes.string.isRequired,
        key: PropTypes.string.isRequired,
        view: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
        entity: PropTypes.string,
    }),
    showFilterGeneric: PropTypes.bool,
    getRowCanExpand: PropTypes.func,
    getRowId: PropTypes.func,
    isLoadingHeaders: PropTypes.bool,
    dataTable: PropTypes.array,
    isLoadingTable: PropTypes.bool,
    refresh: PropTypes.func,
    isFetching: PropTypes.bool,
    columnsToFilter: PropTypes.array,
    errorData: PropTypes.bool,
    fieldsCustomerFilters: PropTypes.array,
    defaultSorting: PropTypes.array,
    onSort: PropTypes.func,
    sortConfig: PropTypes.shape({
        field: PropTypes.string,
        direction: PropTypes.oneOf(["asc", "desc"]),
    }),
    caseStatusCounter: PropTypes.arrayOf(
        PropTypes.shape({
            title: PropTypes.string.isRequired,
            number: PropTypes.number.isRequired,
        }),
    ),
    showSubcasesButton: PropTypes.bool,
    autoResetPageIndex: PropTypes.bool,
    baseFilters: PropTypes.array,
    onClearFilters: PropTypes.func,
    showColumnsDropdown: PropTypes.bool,
    scope: PropTypes.oneOf(Object.values(FILTER_SCOPES)),
};

export const DataTableContainer = memo(DataTableContainerBase);
export default DataTableContainer;
