import {
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import PropTypes from "prop-types";
import { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { GeneralLoader } from "../general-loader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { AllButtonsFilters } from "./AllButtonsFilters";
import { DataTableViewOptions } from "./data-table-view-options-props";
import { DropdownActions } from "./DropdownActions";
import { FilterCustomization } from "./filter-customization";
import useDataTable from "./hooks/useDataTable";
import Pagination from "./pagination";

export function DataTable({
    columns = [],
    isPagination = true,
    hiddenColumns = {},
    showFilterCases = false,
    searchCasesParams = null,
    nameHelper = [],
    nameTable = "",
    keyQueryData = "",
    isLoadingHeaders = false,
    getRowCanExpand = () => false,
    handleActions,
    filterAlternate = [],
    customsfilters = [],
    showFilterGeneric = true,
    columnsToFilter = null,
    showFilterCasesOnlyAll = false,
    customFuction = () => {},
    showColumnsDropdown = true,
}) {
    const [sorting, setSorting] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState(hiddenColumns);
    const [columnFilters, setColumnFilters] = useState([]);
    const [currentFilter, setCurrentFilter] = useState(searchCasesParams);
    const [currentColor, setCurrentColor] = useState("");
    const [rowSelection, setRowSelection] = useState({});
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    const { t } = useTranslation();

    const { dataTable, isLoading, refetch, isRefetching, setNextCountItems } = useDataTable({
        keyQueryData,
        nameTable,
        filter: currentFilter,
        filterAlternate,
        customsfilters,
    });

    const table = useReactTable({
        data: dataTable,
        columns,
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
        enableRowSelection: true,
        autoResetPageIndex: false,
        onPaginationChange: setPagination,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnVisibility,
            columnFilters,
            pagination,
            rowSelection,
        },
    });

    const renderSubComponent = ({ row }) => {
        return (
            <div className="flex flex-wrap p-2 gap-2 border-b-[1px] border-gray-200 justify-center">
                {row.original.children.map((item) => (
                    <div className="flex gap-2 bg-greenCustom w-auto py-2 px-4 rounded-full" key={item.id}>
                        <span className="font-semibold">{t(`gridMain.columns.classifications.${item.id}`)} </span>
                        <span>{item.label}</span>
                    </div>
                ))}
            </div>
        );
    };

    const handleSearchCases = (filter = null) => {
        if (filter === null) {
            if (currentFilter === null) {
                refetch();
            } else {
                setCurrentFilter(null);
                setCurrentColor("");
            }
        } else {
            const { column = "", value = "", title = "", color = "", valueToSearch = null } = filter;
            const newValue = {
                column,
                title,
                value,
                valueToSearch,
            };
            setCurrentFilter(newValue);
            setCurrentColor(color);
        }
    };

    const handleActionCase = (action = "") => {
        let cases = [];
        if (table.getSelectedRowModel().rows.length === 0) {
            toast.info("Debe seleccionar al menos un caso para ejecutar alguna acción");
            return;
        }
        if (action === "reOpen") {
            const filterCases = table
                .getSelectedRowModel()
                .rows.filter((row) => row.original.fecha_resolucion !== null);
            cases = filterCases.map((row) => row.original.id);
            if (cases.length === 0) {
                toast.info("Los casos seleccionados no cumplen las condiciones para poderse reabrir");
                return;
            }
        }
        if (action === "closeCase") {
            const filterCases = table
                .getSelectedRowModel()
                .rows.filter((row) => row.original.fecha_resolucion === null);
            cases = filterCases.map((row) => row.original.id);
            if (cases.length === 0) {
                toast.info("Los casos seleccionados no cumplen las condiciones para poderse cerrar");
                return;
            }
        }
        if (action === "reAssign" || action === "cloneCase") {
            cases = table.getSelectedRowModel().rows.filter((row) => row.original.id);
        }
        handleActions(action, cases);
    };

    useEffect(() => {
        if (searchCasesParams) {
            setCurrentFilter({ ...searchCasesParams });
            setPagination({ pageIndex: 0, pageSize: 10 });
        }
    }, [searchCasesParams]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between">
                {showFilterGeneric && (
                    <FilterCustomization
                        nameHelper={nameHelper}
                        data={dataTable}
                        nameTable={nameTable}
                        keyQueryData={keyQueryData}
                        isLoadingHeaders={isLoadingHeaders}
                        refetch={handleSearchCases}
                        columnsToFilter={columnsToFilter}
                    />
                )}
                {showFilterCases && (
                    <div className="flex gap-2">
                        <AllButtonsFilters
                            handleSearchCases={handleSearchCases}
                            onlyAll={showFilterCasesOnlyAll}
                            customFuction={customFuction}
                            rows={dataTable}
                        />
                        {!showFilterCasesOnlyAll && <DropdownActions handleActionCase={handleActionCase} />}
                    </div>
                )}
                {showColumnsDropdown && <DataTableViewOptions table={table} />}
            </div>
            <div className="flex flex-grow">
                <Table className="bg-background rounded-md">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading || isRefetching || isLoadingHeaders ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    <GeneralLoader />
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <Fragment key={row.id}>
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className={`${currentColor}`}
                                        data-testid={row.original.id}
                                    >
                                        {row.getVisibleCells().map((cell) => {
                                            return (
                                                <TableCell key={cell.id}>
                                                    {cell.column.columnDef.id === "select" ||
                                                    cell.column.columnDef.id === "actions" ? (
                                                        flexRender(cell.column.columnDef.cell, cell.getContext())
                                                    ) : cell.getValue() !== null &&
                                                      cell.getValue() !== undefined &&
                                                      cell.getValue() !== "" ? (
                                                        flexRender(cell.column.columnDef.cell, cell.getContext())
                                                    ) : (
                                                        <p>{t("genericTexts.no_data")}</p>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                    {row.getIsExpanded() && (
                                        <tr>
                                            <td colSpan={row.getVisibleCells().length}>
                                                {renderSubComponent({ row })}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {isLoading || isRefetching ? (
                                        <GeneralLoader />
                                    ) : (
                                        <p>{t("gridMain.text.noResults")}</p>
                                    )}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {isPagination && <Pagination table={table} isLoading={isLoading} setNextCountItems={setNextCountItems} />}
        </div>
    );
}

DataTable.propTypes = {
    columns: PropTypes.array.isRequired,
    isPagination: PropTypes.bool,
    isLoading: PropTypes.bool,
    hiddenColumns: PropTypes.object,
    showFilterCases: PropTypes.bool,
    searchCasesParams: PropTypes.object,
    nameHelper: PropTypes.array,
    nameTable: PropTypes.object,
    keyQueryData: PropTypes.string,
    handleActions: PropTypes.func,
    filterAlternate: PropTypes.array,
    showFilterGeneric: PropTypes.bool,
    getRowCanExpand: PropTypes.func,
    isLoadingHeaders: PropTypes.bool,
    columnsToFilter: PropTypes.array,
    customsfilters: PropTypes.array,
    customFuction: PropTypes.func,
    showFilterCasesOnlyAll: PropTypes.bool,
    showColumnsDropdown: PropTypes.bool,
};
