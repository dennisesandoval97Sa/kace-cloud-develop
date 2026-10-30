import React from "react";
import PropTypes from "prop-types";
import { Item } from "@radix-ui/react-dropdown-menu";
import { cn } from "@kace_v2/shared/utils/cn.util";

const DropdownItem = ({ className, ...props }) => {
    return (
        <Item
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className,
            )}
            {...props} />
    );
};

DropdownItem.propTypes = {
    className: PropTypes.string,
};

export default DropdownItem;
