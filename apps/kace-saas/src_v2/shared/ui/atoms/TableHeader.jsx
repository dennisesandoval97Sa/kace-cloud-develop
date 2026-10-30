import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";

const TableHeader = ({ className, ...props }) => {
    return (
        <thead
            className={cn("[&_tr]:border-b", "[&_th]:sticky [&_th]:top-0 [&_th]:bg-white [&_th]:z-10", className)}
            {...props}
        />
    );
};

TableHeader.propTypes = {
    className: PropTypes.string,
};

export default TableHeader;
