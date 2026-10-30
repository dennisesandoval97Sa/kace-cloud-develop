import React from "react";
import PropTypes from "prop-types";
import Label from "@kace_v2/shared/ui/atoms/Label";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { formatTestId } from "@kace_v2/shared/utils/format-test-id.util";

const FieldWrapper = ({ className, label, error, children }) => {
    return (
        <div className={cn("flex flex-col justify-center items-center gap-3 w-full", className)}>
            <div className="flex w-full flex-col gap-1">
                <Label
                    className={cn("font-semibold", { "text-red-500 font-semibold": error })}
                    data-testid={formatTestId("input-field", label)}
                >
                    {label}
                </Label>
                {error && (
                    <Label
                        className="text-left text-red-500 font-semibold"
                        data-testid={formatTestId("input-field-error", label)}
                    >
                        {error}
                    </Label>
                )}
            </div>
            {children}
        </div>
    );
};

FieldWrapper.propTypes = {
    className: PropTypes.string,
    label: PropTypes.string,
    error: PropTypes.string,
    children: PropTypes.node,
};

export default FieldWrapper;
