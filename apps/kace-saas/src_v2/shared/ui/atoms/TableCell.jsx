import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";

const TableCell = ({ className, ...props }) => {
    return <td className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />;
};

TableCell.propTypes = {
    className: PropTypes.string,
};

export default TableCell;
