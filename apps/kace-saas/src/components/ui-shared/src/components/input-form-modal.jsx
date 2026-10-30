import { PropTypes } from "prop-types"
import { Input as InputCustom } from "./ui/input"
import { Label } from "@kace/ui-shared"
import { cn } from "../lib/utils"

export const InputFormModal = ({
    label = "",
    field = {},
    meta = {},
    className = "",
    labelClassName = "",
    touchedValue = false,
    ...props
}) => {
    let id = props.id ? props.id : props.name
    return (
        <div className={cn("grid grid-cols-4 items-center gap-4", className)}>
            <Label
                htmlFor={id}
                className={`text-sm text-right flex justify-end ${meta.touched && meta.error && "text-redCustom font-semibold"} ${labelClassName}`}
            >
                {label}
            </Label>
            <div className="w-full col-span-3">
                <InputCustom
                    id={id}
                    {...field}
                    {...props}
                    className={`col-span-3 ${meta.touched && meta.error && "border-redCustom"}`}
                    autoComplete="off"
                    data-testid={`input_form_modal_${field.name}`}
                />

                {meta.touched && meta.error && <Label className="text-redCustom font-semibold">{meta.error}</Label>}
            </div>
        </div>
    );
}

InputFormModal.propTypes = {
    name: PropTypes.string.isRequired,
    type: PropTypes.string,
    id: PropTypes.string,
    label: PropTypes.string,
    placeholder: PropTypes.string,
    className: PropTypes.string,
    labelClassName: PropTypes.string,
    field: PropTypes.object,
    meta: PropTypes.object,
    touchedValue: PropTypes.bool
}