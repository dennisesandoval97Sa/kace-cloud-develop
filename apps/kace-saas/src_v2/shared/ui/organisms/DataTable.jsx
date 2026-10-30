import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import Table from "@kace_v2/shared/ui/atoms/Table";
import TableHeader from "@kace_v2/shared/ui/atoms/TableHeader";
import TableHead from "@kace_v2/shared/ui/atoms/TableHead";
import TableRow from "@kace_v2/shared/ui/atoms/TableRow";
import TableCell from "@kace_v2/shared/ui/atoms/TableCell";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { GripVertical, MoreHorizontal, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import Button from "@kace_v2/shared/ui/atoms/Button";
import DropdownMenu from "@kace_v2/shared/ui/molecules/DropdownMenu";
import DataTableBody from "@kace_v2/shared/ui/molecules/DataTableBody";

const defaultGetRowId = (row) => row.id;

const DataTable = ({
    className,
    columns = [],
    rows = [],
    actions = [],
    handlerError = () => {},
    isLoading = false,
    isError = false,
    onOrderChange,
    selectable = false,
    selection = [],
    onToggleRow,
    onTogglePage,
    getRowId = defaultGetRowId,
    sortConfig = { field: null, direction: "asc" },
    onSort,
    ...props
}) => {
    const { t } = useTranslation();
    const [localRows, setLocalRows] = useState(rows);

    const displayColumns = useMemo(() => {
        if (!selectable) return columns;
        return [{ key: "__select__", header: "", width: "40px" }, ...columns];
    }, [selectable, columns]);

    const selectionSet = useMemo(() => new Set(selection), [selection]);

    const pageRowIds = useMemo(() => localRows.map((r) => getRowId(r)).filter(Boolean), [localRows, getRowId]);

    const isAllPageSelected = useMemo(
        () => pageRowIds.length > 0 && pageRowIds.every((id) => selectionSet.has(id)),
        [pageRowIds, selectionSet],
    );

    const onDragStart = useCallback((e, draggedId) => {
        e.dataTransfer.setData("text/plain", draggedId);
        e.dataTransfer.effectAllowed = "move";
    }, []);

    const onDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (e, targetId) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/plain");
            if (!draggedId) return;
            if (draggedId === targetId) return;

            const getId = (r) => r.id ?? JSON.stringify(r);
            const oldIndex = localRows.findIndex((r) => getId(r) === draggedId);
            const newIndex = localRows.findIndex((r) => getId(r) === targetId);
            if (oldIndex === -1 || newIndex === -1) return;

            const copy = [...localRows];
            const [moved] = copy.splice(oldIndex, 1);
            copy.splice(newIndex, 0, moved);
            setLocalRows(copy);
            if (typeof onOrderChange === "function") onOrderChange(copy);
        },
        [localRows, setLocalRows, onOrderChange],
    );

    const callAction = useCallback(
        (actionFn, row, index) => {
            if (typeof actionFn !== "function") return;
            const payload = {
                row,
                index,
                allRows: localRows,
            };
            actionFn(payload);
        },
        [localRows],
    );

    const handleHeaderSelectChange = useCallback(() => {
        if (typeof onTogglePage === "function") onTogglePage(pageRowIds);
    }, [onTogglePage, pageRowIds]);

    const handleRowSelectChange = useCallback(
        (row) => {
            const id = getRowId(row);
            if (!id || typeof onToggleRow !== "function") return;
            onToggleRow(id);
        },
        [getRowId, onToggleRow],
    );

    const resolveRowActions = useCallback(
        (row, rowIndex) => {
            const resolvedActions = actions
                .map((action) => {
                    const payload = { row, index: rowIndex, allRows: localRows };
                    const isHidden = action.hidden?.(payload);
                    if (isHidden) return null;

                    const isDisabled =
                        typeof action.disabled === "function" ? action.disabled(payload) : (action.disabled ?? false);

                    const tooltip =
                        typeof action.tooltip === "function" ? action.tooltip(payload) : (action.tooltip ?? undefined);

                    return {
                        ...action,
                        disabled: isDisabled,
                        tooltip,
                    };
                })
                .filter(Boolean);

            if (resolvedActions.length > 0) return resolvedActions;

            return [{ label: t("dataTable.noActionsAvailable"), disabled: true }];
        },
        [actions, localRows, t],
    );

    useEffect(() => {
        if (rows) {
            setLocalRows(rows);
        }
    }, [rows]);

    return (
        <Table className={cn("bg-background rounded-md", className)} {...props}>
            <TableHeader>
                <TableRow>
                    {displayColumns.map((column) => (
                        <TableHead
                            key={column.key}
                            style={{
                                width: column.width || "auto",
                            }}
                        >
                            {column.key === "__select__" ? (
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border"
                                    checked={isAllPageSelected}
                                    onChange={handleHeaderSelectChange}
                                    aria-label={t("dataTable.selectPage")}
                                />
                            ) : column.sortable && typeof onSort === "function" ? (
                                <button
                                    type="button"
                                    onClick={() => onSort(column.sortField ?? column.key)}
                                    className="flex items-center gap-1 font-semibold cursor-pointer hover:text-foreground/80 select-none"
                                >
                                    {column.header}
                                    {sortConfig.field === (column.sortField ?? column.key) ? (
                                        sortConfig.direction === "asc" ? (
                                            <ChevronUp className="h-4 w-4" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4" />
                                        )
                                    ) : (
                                        <ChevronsUpDown className="h-4 w-4 opacity-40" />
                                    )}
                                </button>
                            ) : (
                                <p className="font-semibold">{column.header}</p>
                            )}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <DataTableBody
                columns={displayColumns}
                rows={localRows}
                isLoading={isLoading}
                isError={isError}
                handlerError={handlerError}
            >
                {localRows.length > 0 &&
                    localRows.map((row, rowIndex) => {
                        const rowId = row.id;
                        const resolvedRowId = getRowId(row);
                        return (
                            <TableRow
                                key={resolvedRowId ?? rowId ?? rowIndex}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDrop(e, rowId)}
                            >
                                {displayColumns.map((column) => {
                                    if (column.key === "__select__") {
                                        return (
                                            <TableCell
                                                key={column.key}
                                                style={column.width ? { width: column.width } : undefined}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border"
                                                    checked={resolvedRowId ? selectionSet.has(resolvedRowId) : false}
                                                    onChange={() => handleRowSelectChange(row)}
                                                    aria-label={t("dataTable.selectRow")}
                                                />
                                            </TableCell>
                                        );
                                    }

                                    if (column.key === "actions") {
                                        const rowActions = resolveRowActions(row, rowIndex);

                                        return (
                                            <TableCell
                                                key={column.key}
                                                style={column.width ? { width: column.width } : undefined}
                                            >
                                                <DropdownMenu
                                                    label="Acciones"
                                                    options={rowActions}
                                                    onSelect={(data) => callAction(data.fn, row, rowIndex)}
                                                >
                                                    <Button variant="ghost" className="h-8 w-8 p-0 bold">
                                                        <MoreHorizontal className="h-6 w-6" />
                                                    </Button>
                                                </DropdownMenu>
                                            </TableCell>
                                        );
                                    }

                                    if (column.key === "draggable" && rowId) {
                                        return (
                                            <TableCell
                                                key={column.key}
                                                style={column.width ? { width: column.width } : undefined}
                                            >
                                                <Button
                                                    type="button"
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, rowId)}
                                                    aria-label="Arrastrar fila"
                                                    title="Mantén y arrastra"
                                                    variant="outline"
                                                    className="border-0 bg-transparent cursor-grab"
                                                >
                                                    <GripVertical />
                                                </Button>
                                            </TableCell>
                                        );
                                    }

                                    return (
                                        <TableCell
                                            key={column.key}
                                            style={column.width ? { width: column.width } : undefined}
                                        >
                                            {row[column.key] || "-"}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        );
                    })}
            </DataTableBody>
        </Table>
    );
};

DataTable.propTypes = {
    className: PropTypes.string,
    columns: PropTypes.arrayOf(
        PropTypes.shape({
            key: PropTypes.string.isRequired,
            header: PropTypes.string.isRequired,
            width: PropTypes.string,
        }),
    ),
    rows: PropTypes.array,
    actions: PropTypes.array,
    handlerError: PropTypes.func,
    isLoading: PropTypes.bool,
    isError: PropTypes.bool,
    onOrderChange: PropTypes.func,
    selectable: PropTypes.bool,
    selection: PropTypes.arrayOf(PropTypes.string),
    onToggleRow: PropTypes.func,
    onTogglePage: PropTypes.func,
    getRowId: PropTypes.func,
    sortConfig: PropTypes.shape({
        field: PropTypes.string,
        direction: PropTypes.oneOf(["asc", "desc"]),
    }),
    onSort: PropTypes.func,
};

export default DataTable;
