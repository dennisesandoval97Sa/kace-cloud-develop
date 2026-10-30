import React from "react";
import PropTypes from "prop-types";
import { Close } from "@radix-ui/react-dialog";
import { cn } from "@kace_v2/shared/utils/cn.util";

const DialogClose = ({ className, children, ...props }) => {
    return (
        <Close
            className={cn(
                "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
                className,
            )}
            {...props}
        >
            {children}
        </Close>
    );
};

DialogClose.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
};

export default DialogClose;
