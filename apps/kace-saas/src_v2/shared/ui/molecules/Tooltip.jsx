import React from "react";
import PropTypes from "prop-types";
import { Provider, Root, Trigger, Content, Arrow } from "@radix-ui/react-tooltip";
import { cn } from "@kace_v2/shared/utils/cn.util";

const Tooltip = ({ children, className, content, ...props }) => {
    return (
        <Provider>
            <Root>
                <Trigger asChild>
                    {children}
                </Trigger>
                <Content sideOffset={5} className={cn("z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", className)} {...props}>
                    {content}
                    <Arrow className="TooltipArrow" />
                </Content>
            </Root>
        </Provider>

    );
};

Tooltip.propTypes = {
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    content: PropTypes.string,
};

export default Tooltip;
