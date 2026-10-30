import React from "react";
import PropTypes from "prop-types";
import { Portal, Root, Trigger } from "@radix-ui/react-popover";
import PopoverContent from "@kace_v2/shared/ui/atoms/PopoverContent";

const Popover = ({ className, trigger, children, ...props }) => {
    return (
        <Root {...props}>
            <Trigger asChild>{trigger}</Trigger>
            <Portal>
                <PopoverContent className={className} align="start">
                    {children}
                </PopoverContent>
            </Portal>
        </Root>
    );
};

Popover.propTypes = {
    className: PropTypes.string,
    trigger: PropTypes.node,
    children: PropTypes.node,
};

export default Popover;
