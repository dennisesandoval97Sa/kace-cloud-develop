import { Label } from "@kace/ui-shared"
import PropTypes from "prop-types"

const InputSelect = ({children, title}) => {
    return (
        <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-sm text-right flex justify-end">
                {title}
            </Label>
            {children}
        </div>
    )
}

InputSelect.propTypes = {
    children: PropTypes.node,
    title: PropTypes.string,
}

export default InputSelect
