import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";
import Textarea from "@kace_v2/shared/ui/atoms/Textarea";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";

const TextareaField = ({ className, error, label, ...props }) => {
    return (
        <FieldWrapper label={label} error={error}>
            <Textarea
                className={cn("col-span-3", className, {
                    "border-red-500": error,
                })}
                {...props}
            />
        </FieldWrapper>
    );
};

TextareaField.propTypes = {
    className: PropTypes.string,
    error: PropTypes.string,
    label: PropTypes.string,
};

export default TextareaField;
