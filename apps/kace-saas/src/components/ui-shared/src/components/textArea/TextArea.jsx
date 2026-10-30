import { PropTypes } from "prop-types"
import { InputErrors } from "../InputErrors"
import { cn } from "../../lib/utils"
import { Label } from "../ui/label"

export const TextArea = ({
    label,
    field = {},
    meta = {},
    className = "",
    ...props
}) => {
    return (
        <div className={cn("grid grid-cols-4 items-center gap-4", className)}>
            <Label
                htmlFor={props.id}
                className="text-sm text-right flex justify-end"
            >
                {label}
            </Label>
            <textarea
                {...field}
                {...props}
                className="col-span-3 border-2 rounded-md w-full min-h-32 p-2"
            />
            <InputErrors meta={meta} />
        </div>
    )
}
TextArea.propTypes = {
    label: PropTypes.string,
    id: PropTypes.string,
    name: PropTypes.string,
    placeholder: PropTypes.string,
    field: PropTypes.object,
    meta: PropTypes.object,
    className: PropTypes.string,
}
