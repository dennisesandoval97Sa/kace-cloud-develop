import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";

const TableHead = ({ className, ...props }) => {
    return (
        <th
            className={cn(
                "border-b border-t h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
                className,
            )}
            {...props}
        />
    );
};

TableHead.propTypes = {
    className: PropTypes.string,
};

export default TableHead;
