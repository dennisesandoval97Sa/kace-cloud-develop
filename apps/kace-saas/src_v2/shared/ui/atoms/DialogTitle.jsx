import React from "react";
import PropTypes from "prop-types";
import { Title } from "@radix-ui/react-dialog";
import { cn } from "@kace_v2/shared/utils/cn.util";

const DialogTitle = ({ className, children, ...props }) => {
    return (
        <Title className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props}>
            {children}
        </Title>
    );
};

DialogTitle.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
};

export default DialogTitle;
