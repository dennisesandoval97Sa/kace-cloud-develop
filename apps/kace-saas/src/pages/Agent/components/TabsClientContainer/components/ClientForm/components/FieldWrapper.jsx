import PropTypes from "prop-types"
export const FieldWrapper = ({ children }) => (
    <div className="p-2 rounded-md flex-1 min-w-[300px]">
        {children}
    </div>
)

FieldWrapper.propTypes = {
    children: PropTypes.node.isRequired
}
