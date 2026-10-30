import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";

const Table = ({ className, children, ...props }) => {
    return (
        <table className={cn("w-full caption-bottom text-sm", className)} {...props}>
            {children}
        </table>
    );
};

Table.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
};

export default Table;
