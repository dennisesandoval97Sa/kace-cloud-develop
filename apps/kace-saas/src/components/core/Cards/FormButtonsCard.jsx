
import { PropTypes } from "prop-types"
const FormButtonsCard = ({ children }) => {
    return (
        <div className="flex flex-col justify-end items-center my-2 p-2">
            {children}
        </div>
    )
}
FormButtonsCard.propTypes = {
    children: PropTypes.node.isRequired
}

export default FormButtonsCard
