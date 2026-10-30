import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";
import Input from "@kace_v2/shared/ui/atoms/Input";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";

const InputField = ({ className, error, label, ...props }) => {
    return (
        <FieldWrapper label={label} error={error}>
            <Input
                className={cn("col-span-3", className, {
                    "border-red-500": error,
                })}
                {...props}
            />
        </FieldWrapper>
    );
};

InputField.propTypes = {
    className: PropTypes.string,
    error: PropTypes.string,
    label: PropTypes.string,
};

export default InputField;
