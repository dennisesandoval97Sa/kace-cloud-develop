import { PropTypes } from "prop-types"
const InputCard = ({ children, full = false, className = "" }) => {
    const fixedClass = ""
    const defaultClass = ""
    const htmlClass = full ? fixedClass : defaultClass
    return <div className={`${htmlClass} ${className}`}>{children}</div>
}
InputCard.propTypes = {
    children: PropTypes.node,
    full: PropTypes.bool,
    className: PropTypes.string
}

export default InputCard
