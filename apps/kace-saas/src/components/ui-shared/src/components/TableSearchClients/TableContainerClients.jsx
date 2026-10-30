import {
    GeneralLoader,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@kace/ui-shared"
import PropTypes from "prop-types"
import { useTranslation } from "react-i18next"

import {
    flexRender,
    getCoreRowModel,
    useReactTable
} from "@tanstack/react-table"

export const TableContainerClients = ({
    data = [],
    isLoading,
    columns = []
}) => {
    const { t } = useTranslation()
    const columnVisibility = columns
        .filter((column) => column.isVisible)
        .reduce((acc, item) => {
            acc[item.accessorKey] = item.isVisible
            return acc
        }, {})

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        state: {
            columnVisibility
        }
    })
    return (
        <div className="rounded-md border" id="table_container_clients" data-testid="table_container_clients">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} id={`table_client_header_row_${headerGroup.id}`} data-testid={`table_client_header_row_${headerGroup.id}`}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead key={header.id} id={`table_client_header_cell_${header.id}`}
                                        data-testid={`table_client_header_cell_${header.id}`}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef
                                                    .header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {isLoading
                        ? (
                            <TableRow id="table_loading_row"
                                data-testid="table_loading_row">
                                <TableCell
                                    colSpan={columns?.length}
                                    className="h-24 text-center"
                                    id="table_client_loading_cell"
                                    data-testid="table_client_loading_cell"
                                >
                                    <GeneralLoader />
                                </TableCell>
                            </TableRow>
                        )
                        : table.getRowModel().rows?.length
                            ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        id={`table_client_row_${row.id}`}
                                        data-testid={`table_client_row_${row.id}`}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} id={`table_client_cell_${cell.id}`}
                                                data-testid={`table_client_cell_${cell.id}`}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )
                            : (
                                <TableRow id="table_client_no_results_row"
                                    data-testid="table_client_no_results_row">
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center"
                                        id="table_client_no_results_cell"
                                        data-testid="table_client_no_results_cell"

                                    >
                                        {t("gridMain.text.noResults")}
                                    </TableCell>
                                </TableRow>
                            )}
                </TableBody>
            </Table>
        </div>
    )
}

TableContainerClients.propTypes = {
    data: PropTypes.array,
    setOpenModal: PropTypes.func,
    isLoading: PropTypes.bool,
    columns: PropTypes.array.isRequired
}
