import React, { Fragment, memo } from "react"
import PropTypes from "prop-types"
import { TableBody, TableCell, TableRow } from "@/components/ui-shared"

const DataTableBody = ({ processedRows, emptyState }) => {
    if (processedRows.length === 0) {
        return <TableBody>{emptyState}</TableBody>
    }

    return (
        <TableBody>
            {processedRows.map((row) => (
                <Fragment key={row.id}>
                    <TableRow key={row.mainRow.id} style={row.mainRow.style} id={`dt_body_tablerow_${row?.subRow?.id}`}
                        data-testid={`dt_body_tablerow_${row?.subRow?.id}`}>
                        {row.mainRow.cells.map((cell, index) => (
                            <TableCell key={`${cell.id}_${index}`} id={`dt_body_${cell.id}_${index}`} data-testid={`dt_body_${cell.id}_${index}`}>
                                {cell.content}
                            </TableCell>
                        ))}
                    </TableRow>

                    {row.subRow && (
                        <TableRow
                            key={row.subRow.id}
                            style={row.subRow.style}
                            id={`dt_body_subrow_${row.subRow.id}`}
                            data-testid={`dt_body_subrow_${row.subRow.id}`}
                        >
                            <TableCell colSpan={row.subRow.colSpan} className="p-0 w-full">
                                {row.subRow.content}
                            </TableCell>
                        </TableRow>
                    )}
                </Fragment>
            ))}
        </TableBody>
    )
}

DataTableBody.propTypes = {
    processedRows: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            mainRow: PropTypes.shape({
                id: PropTypes.string.isRequired,
                style: PropTypes.object,
                cells: PropTypes.arrayOf(
                    PropTypes.shape({
                        id: PropTypes.string.isRequired,
                        content: PropTypes.node
                    })
                ).isRequired
            }).isRequired,
            subRow: PropTypes.shape({
                id: PropTypes.string.isRequired,
                style: PropTypes.object,
                colSpan: PropTypes.number.isRequired,
                content: PropTypes.node
            })
        })
    ).isRequired,
    emptyState: PropTypes.node,
}

export default memo(DataTableBody)
