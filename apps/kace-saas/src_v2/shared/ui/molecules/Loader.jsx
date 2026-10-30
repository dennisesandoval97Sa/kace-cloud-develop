import React from "react";
import PropTypes from "prop-types";
import { Loader2 } from "lucide-react";
import { cn } from "@kace_v2/shared/utils/cn.util";
import AppLogo from "@kace_v2/shared/ui/icons/AppLogo";

const Loader = ({ className }) => {
    return (
        <div className={cn("relative h-64 w-full flex justify-center items-center", className)}>
            <Loader2 className="h-36 w-36 animate-spin text-primary" />
            <div className="h-16 w-16 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <AppLogo height={64} width={64} />
            </div>
        </div>
    );
};

Loader.propTypes = {
    className: PropTypes.string,
};

export default Loader;
