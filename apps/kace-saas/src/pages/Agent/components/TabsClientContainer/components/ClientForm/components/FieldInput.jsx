import { InputForm as Input, KField } from "@kace/ui-shared"
import PropTypes from "prop-types"

const FieldInput = ({ name, label, disabled = false, onKeyDown = () => {} }) => (
    <div className="p-2 rounded-md flex-1 min-w-[300px]">
        <KField>
            <Input
                type="text"
                name={name}
                label={label}
                placeholder={label}
                className="flex flex-col items-start justify-start text-start"
                disabled={disabled}
                onKeyDown={onKeyDown}
            />
        </KField>
    </div>
)

FieldInput.propTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    onKeyDown: PropTypes.func
}

export default FieldInput
