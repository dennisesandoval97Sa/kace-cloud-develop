import React from "react";
import PropTypes from "prop-types";
import { Description } from "@radix-ui/react-dialog";
import { cn } from "@kace_v2/shared/utils/cn.util";

const DialogDescription = ({ className, children, ...props }) => {
    return (
        <Description className={cn("text-sm text-muted-foreground", className)} {...props}>
            {children}
        </Description>
    );
};

DialogDescription.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
};

export default DialogDescription;
