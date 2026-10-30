import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";

const Label = ({ className, children, ...props }) => {
    return (
        <label
            className={cn(
                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                className,
            )}
            {...props}
        >
            {children}
        </label>
    );
};

Label.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
};

export default Label;
