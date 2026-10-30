import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";
import Switch from "@kace_v2/shared/ui/atoms/Switch";
import Label from "@kace_v2/shared/ui/atoms/Label";
import { formatTestId } from "@kace_v2/shared/utils/format-test-id.util";

const SwitchField = ({ label, error, className, ...props }) => {
    return (
        <div
            className={cn("flex items-center gap-2 border-input border p-4 rounded-md justify-between", {
                "border-red-500": error,
            })}
        >
            <div className="flex flex-col w-full justify-between items-start gap-2">
                <Label
                    className={cn("flex justify-end font-semibold", { "text-red-500 font-semibold": error })}
                    data-testid={formatTestId("input-field", label)}
                >
                    {label}
                </Label>
                {error && (
                    <Label
                        className="text-right text-red-500 font-semibold"
                        data-testid={formatTestId("input-field-error", label)}
                    >
                        {error}
                    </Label>
                )}
            </div>
            <Switch className={cn("col-span-3", className)} {...props} />
        </div>
    );
};

SwitchField.propTypes = {
    label: PropTypes.string,
    error: PropTypes.string,
    className: PropTypes.string,
};

export default SwitchField;
