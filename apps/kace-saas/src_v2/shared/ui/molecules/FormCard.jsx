import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { formatTestId } from "@kace_v2/shared/utils/format-test-id.util";
import Label from "@kace_v2/shared/ui/atoms/Label";

const FormCard = ({ className, title, description, error, children }) => {
    return (
        <div
            data-testid={formatTestId("form-card", title)}
            className={cn("bg-background p-4 shadow-md rounded-md flex flex-col gap-4", className)}
        >
            <div className="flex w-full justify-between">
                <div className="w-full">
                    <div className=" w-full grid grid-cols-1 lg:grid-cols-2 gap-2">
                        <h3
                            className={cn("text-xl font-semibold", { "text-red-500 font-semibold": error })}
                            data-testid={formatTestId("form-card-title", title)}
                        >
                            {title}
                        </h3>
                        {error && <Label className="text-right text-lg text-red-500 font-semibold">{error}</Label>}
                    </div>

                    {description && (
                        <h3
                            className="text-sm text-gray-400"
                            data-testid={formatTestId("form-card-sub-title", description)}
                        >
                            {description}
                        </h3>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
};

FormCard.propTypes = {
    className: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    error: PropTypes.string,
    children: PropTypes.node,
};

export default FormCard;
