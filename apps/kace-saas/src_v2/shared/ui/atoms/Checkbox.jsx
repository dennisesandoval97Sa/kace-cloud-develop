import React from "react";
import PropTypes from "prop-types";
import { Indicator, Root } from "@radix-ui/react-checkbox";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { CheckIcon } from "lucide-react";

const Checkbox = ({ className, ...props }) => {
    return (
        <Root
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
                className,
            )}
            {...props}
        >
            <Indicator className="flex items-center justify-center text-current">
                <CheckIcon className="h-4 w-4" />
            </Indicator>
        </Root>
    );
};

Checkbox.propTypes = {
    className: PropTypes.string,

};

export default Checkbox;
