import React, { memo } from "react";
import PropTypes from "prop-types";
import { TableHead, TableHeader, TableRow } from "@/components/ui-shared";

const DataTableHeader = ({ processedHeader }) => {
    return (
        <TableHeader>
            <TableRow className="bg-background hover:bg-background">
                {processedHeader.map((header, index) => (
                    <TableHead
                        key={`${header.id}_${index}`}
                        colSpan={header.colSpan}
                        className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]"
                        id={`dt_header_${header.id}_${index}`}
                        data-testid={`dt_header_${header.id}_${index}`}
                    >
                        {header.content}
                    </TableHead>
                ))}
            </TableRow>
        </TableHeader>
    );
};

DataTableHeader.propTypes = {
    processedHeader: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            colSpan: PropTypes.number.isRequired,
            content: PropTypes.node,
        }),
    ).isRequired,
};

export default memo(DataTableHeader);
