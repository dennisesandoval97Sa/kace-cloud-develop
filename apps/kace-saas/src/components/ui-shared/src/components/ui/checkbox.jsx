import { Indicator, Root } from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "../../lib/utils";
import { forwardRef } from "react";
import PropTypes from "prop-types";

const Checkbox = forwardRef(({ className = "", checked = false, ...props }, ref) => (
    <Root
        ref={ref}
        className={cn(
            "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
            className,
        )}
        checked={checked}
        {...props}
    >
        <Indicator className={cn("flex items-center justify-center text-current")} data-testid="checkox_indicator" id="checkbox_indicator">
            {checked === "indeterminate" && <Minus className="h-4 w-4" />}
            {checked === true && <Check className="h-4 w-4" />}
        </Indicator>
    </Root>
));
Checkbox.propTypes = {
    className: PropTypes.string,
    checked: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf(["indeterminate"])]),
};
Checkbox.displayName = Root.displayName;

export { Checkbox };
