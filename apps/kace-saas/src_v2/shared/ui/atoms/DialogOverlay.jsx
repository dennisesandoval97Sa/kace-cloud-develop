import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import { Overlay } from "@radix-ui/react-dialog";
import { cn } from "@kace_v2/shared/utils/cn.util";

const DialogOverlay = forwardRef(({ className, ...props }, ref) => {
    return (
        <Overlay
            ref={ref}
            className={cn(
                "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                className,
            )}
            {...props}
        />
    );
});

DialogOverlay.displayName = "DialogOverlay";

DialogOverlay.propTypes = {
    className: PropTypes.string,
};

export default DialogOverlay;
