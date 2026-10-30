import { Label } from "@kace/ui-shared"
import PropTypes from "prop-types"

const LabelInput = ({ id = "input", label = "", meta }) => {
    return (
        <Label
            htmlFor={id}
            data-testid={`label_input_${id}`}
            id={`label_input_${id}`}
            className={`text-sm text-right flex justify-end ${meta.touched && meta.error && "text-redCustom font-semibold"}`}
        >
            {label}
        </Label>
    )
}

LabelInput.propTypes = {
    id: PropTypes.string,
    label: PropTypes.string,
    meta: PropTypes.object,
}

export default LabelInput
