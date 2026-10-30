import { PropTypes } from "prop-types";
import { useFormikContext } from "formik";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@kace/ui-shared";
import { cn } from "@/componentsV2/lib/utils";

// Remaining props (aria-*, id, ...) go to the trigger.
export const SimpleSelect = ({ name, options, placeholder, onChange, className, ...triggerProps }) => {
    const { values, setFieldValue } = useFormikContext();
    const fieldValue = name.split(".").reduce((obj, key) => obj?.[key], values);

    return (
        <Select
            value={fieldValue || ""}
            onValueChange={(value) => {
                setFieldValue(name, value);
                onChange?.(value);
            }}
        >
            <SelectTrigger {...triggerProps} className={cn("w-full h-10", className)}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
};

SimpleSelect.propTypes = {
    name: PropTypes.string.isRequired,
    options: PropTypes.array.isRequired,
    placeholder: PropTypes.string,
    onChange: PropTypes.func,
    className: PropTypes.string,
};
