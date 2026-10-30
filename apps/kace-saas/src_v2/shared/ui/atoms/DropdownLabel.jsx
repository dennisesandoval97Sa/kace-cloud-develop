import React from "react";
import PropTypes from "prop-types";
import { Label } from "@radix-ui/react-dropdown-menu";
import { cn } from "@kace_v2/shared/utils/cn.util";

const DropdownLabel = ({ className, ...props }) => {
    return <Label in className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />;
};

DropdownLabel.propTypes = {
    className: PropTypes.string,
};

export default DropdownLabel;
