import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";

const TableRow = ({ className, ...props }) => {
    return (
        <tr
            className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
            {...props}
        />
    );
};

TableRow.propTypes = {
    className: PropTypes.string,
};

export default TableRow;
