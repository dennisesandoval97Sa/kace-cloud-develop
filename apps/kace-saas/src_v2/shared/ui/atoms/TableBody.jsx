import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";

const TableBody = ({ className, ...props }) => {
    return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
};

TableBody.propTypes = {
    className: PropTypes.string,
};

export default TableBody;
