import React from "react";
import PropTypes from "prop-types";
import { Root, Separator, Trigger } from "@radix-ui/react-dropdown-menu";
import DropdownContent from "@kace_v2/shared/ui/atoms/DropdownContent";
import DropdownLabel from "@kace_v2/shared/ui/atoms/DropdownLabel";
import DropdownItem from "@kace_v2/shared/ui/atoms/DropdownItem";
import Tooltip from "@kace_v2/shared/ui/molecules/Tooltip";
import { cn } from "@kace_v2/shared/utils/cn.util";

const DropdownMenu = ({ className, label, options, onSelect = () => {}, children, ...props }) => {
    return (
        <Root {...props}>
            <Trigger asChild>{children}</Trigger>
            <DropdownContent sideOffset={6} align="start" className={className}>
                <DropdownLabel>{label}</DropdownLabel>
                <Separator className="-mx-1 my-1 h-px bg-muted" />
                {options &&
                    options.length > 0 &&
                    options.map((option, index) => {
                        const isDisabled = Boolean(option?.disabled);
                        const showTooltip = isDisabled && option?.tooltip;
                        const item = (
                            <DropdownItem
                                className={cn(option?.className || "", showTooltip && "opacity-50 cursor-not-allowed")}
                                onSelect={(e) => {
                                    if (isDisabled) {
                                        e.preventDefault();
                                        return;
                                    }
                                    onSelect(option);
                                }}
                                disabled={isDisabled && !showTooltip}
                            >
                                {option?.label || ""}
                            </DropdownItem>
                        );
                        if (showTooltip) {
                            return (
                                <Tooltip key={index} content={option.tooltip}>
                                    <span className="block w-full">{item}</span>
                                </Tooltip>
                            );
                        }
                        return <React.Fragment key={index}>{item}</React.Fragment>;
                    })}
            </DropdownContent>
        </Root>
    );
};

DropdownMenu.propTypes = {
    className: PropTypes.string,
    label: PropTypes.string,
    options: PropTypes.array,
    onSelect: PropTypes.func,
    children: PropTypes.node,
};

export default DropdownMenu;
