import { cn } from "../../lib/utils";
import React from "react";
import PropTypes from "prop-types";

export const MenuBar = ({ children, className }) => {
    return (
        <header className={cn("w-full min-h-[4rem] flex py-2 px-4 gap-2 items-center z-10 col-span-3", className)}>
            <div className="w-full flex justify-center">{children}</div>
        </header>
    );
};

MenuBar.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    logOut: PropTypes.func,
    handleChangeApp: PropTypes.func,
    handleCurrentPosition: PropTypes.func,
};
