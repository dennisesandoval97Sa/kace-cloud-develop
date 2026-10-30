import { memo } from "react";
import PropTypes from "prop-types";

import DataTableWrapper from "./components/DataTableWrapper";
import DataTableHeader from "./components/DataTableHeader";
import DataTableBody from "./components/DataTableBody";
import DataTablePagination from "./components/DataTablePagination";
import DataTableColumnSelector from "./components/DataTableColumnSelector";
import DataTableUpdate from "./components/DataTableUpdate";
import DataTableFilters from "./components/DataTableFilters";
import DataTableCasesFilters from "./components/DataTableCasesFilters";
import { Table } from "@/components/ui-shared";
import DataTableNewFilterModal from "./components/DataTableNewFilterModal";
import DataTableBulkActions from "./components/DataTableBulkActions";

const DataTable = ({ renderData, query, filters, casesFilters, pagination, columnSelector, bulkActions }) => {
    const { processedHeader, rows, emptyState } = renderData;
    const { isLoading, isError, isFetching, refetch = null, handleRefresh } = query;
    const {
        onApply,
        onClear,
        schema,
        savedFilterList,
        isActive: isFiltered,
        hasClearableBaseFilters = false,
        setOpenNewFilterModal,
        openNewFilterModal,
        handleSaveFilter,
        handleDeleteFilter,
        onFilterSelect,
        currentFiltersValues,
        selectedFilter,
        pageSize,
        pageSizeOptions,
    } = filters;

    return (
        <DataTableWrapper isLoading={isLoading} isError={isError} handleRefresh={handleRefresh}>
            <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex shrink-0 justify-between flex-row-reverse items-center">
                    {columnSelector && (
                        <DataTableColumnSelector
                            columns={columnSelector.columns}
                            onToggleVisibility={columnSelector.onToggleVisibility}
                        />
                    )}

                    {casesFilters && (
                        <DataTableCasesFilters filterButtonsConfig={casesFilters} isFetching={isFetching} />
                    )}

                    <div className="flex items-center gap-2">
                        <DataTableBulkActions bulkActions={bulkActions} />
                        {schema?.length > 0 && (
                            <DataTableFilters
                                onApply={onApply}
                                onClear={onClear}
                                schema={schema}
                                savedFilterList={savedFilterList}
                                isFiltered={isFiltered}
                                hasClearableBaseFilters={hasClearableBaseFilters}
                                isLoading={isLoading}
                                currentFiltersValues={currentFiltersValues}
                                onFilterSelect={onFilterSelect}
                                onDeleteFilter={handleDeleteFilter}
                                selectedFilter={selectedFilter}
                                pageSize={pageSize}
                                pageSizeOptions={pageSizeOptions}
                                onRefresh={refetch ?? null}
                                isFetching={isFetching}
                            />
                        )}
                        {refetch && !(schema?.length > 0) && (
                            <DataTableUpdate onRefresh={refetch} isFetching={isFetching} />
                        )}
                    </div>
                </div>

                <Table containerClassName="min-h-0 flex-1" className="bg-background rounded-md">
                    <DataTableHeader processedHeader={processedHeader} />
                    <DataTableBody processedRows={rows} emptyState={emptyState} />
                </Table>

                {pagination && (
                    <div className="shrink-0">
                        <DataTablePagination {...pagination} isFetching={isFetching} />
                    </div>
                )}
            </div>

            <DataTableNewFilterModal
                open={openNewFilterModal}
                setOpen={setOpenNewFilterModal}
                onSave={handleSaveFilter}
            />
        </DataTableWrapper>
    );
};
DataTable.propTypes = {
    renderData: PropTypes.shape({
        processedHeader: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.string.isRequired,
                colSpan: PropTypes.number.isRequired,
                content: PropTypes.node,
            }),
        ).isRequired,
        rows: PropTypes.array.isRequired,
        emptyState: PropTypes.node,
    }).isRequired,
    query: PropTypes.shape({
        isLoading: PropTypes.bool,
        isError: PropTypes.bool,
        isFetching: PropTypes.bool,
        refetch: PropTypes.func,
        handleRefresh: PropTypes.func.isRequired,
    }).isRequired,
    filters: PropTypes.shape({
        onApply: PropTypes.func.isRequired,
        onClear: PropTypes.func.isRequired,
        schema: PropTypes.arrayOf(
            PropTypes.shape({
                column_name: PropTypes.string.isRequired,
                header: PropTypes.string.isRequired,
                data_type: PropTypes.string.isRequired,
                filterData: PropTypes.shape({
                    field: PropTypes.string.isRequired,
                    operator: PropTypes.string.isRequired,
                    type: PropTypes.string.isRequired,
                }),
                label: PropTypes.string,
            }),
        ).isRequired,
        savedFilterList: PropTypes.array,
        openNewFilterModal: PropTypes.bool.isRequired,
        setOpenNewFilterModal: PropTypes.func.isRequired,
        handleSaveFilter: PropTypes.func.isRequired,
        handleDeleteFilter: PropTypes.func,
        onFilterSelect: PropTypes.func.isRequired,
        selectedFilter: PropTypes.string,
        currentFiltersValues: PropTypes.object,
        isActive: PropTypes.bool,
        hasClearableBaseFilters: PropTypes.bool,
        pageSize: PropTypes.number,
        pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
    }).isRequired,
    casesFilters: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            textMessage: PropTypes.string.isRequired,
            icon: PropTypes.element,
            action: PropTypes.func.isRequired,
        }),
    ),
    pagination: PropTypes.shape({
        page: PropTypes.number,
        totalPages: PropTypes.number,
        totalRecords: PropTypes.number,
        pageSize: PropTypes.number,
        pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
        onFirstPage: PropTypes.func,
        onPreviousPage: PropTypes.func.isRequired,
        canPreviousPage: PropTypes.bool.isRequired,
        onNextPage: PropTypes.func.isRequired,
        canNextPage: PropTypes.bool.isRequired,
        onLastPage: PropTypes.func,
        onGoToPage: PropTypes.func,
        onPageSizeChange: PropTypes.func,
    }),
    columnSelector: PropTypes.shape({
        columns: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.string.isRequired,
                displayName: PropTypes.string.isRequired,
                isVisible: PropTypes.bool.isRequired,
            }),
        ).isRequired,
        onToggleVisibility: PropTypes.func.isRequired,
    }),
    bulkActions: PropTypes.shape({
        selectedCount: PropTypes.number.isRequired,
        onClearSelection: PropTypes.func.isRequired,
        actions: PropTypes.arrayOf(
            PropTypes.shape({
                label: PropTypes.string.isRequired,
                onClick: PropTypes.func.isRequired,
            }),
        ).isRequired,
    }),
};

export default memo(DataTable);
