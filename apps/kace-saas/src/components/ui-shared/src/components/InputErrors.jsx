import { PropTypes } from "prop-types"
export const InputErrors = ({ meta }) => {
    return (
        <>
            {meta.touched && meta.error && (
                <div className="relative rounded-md px-1 text-sm font-semibold text-red-500">
                    <span className="text-redCustom">{meta.error}</span>
                </div>
            )}
        </>
    )
}
InputErrors.propTypes = {
    meta: PropTypes.shape({
        touched: PropTypes.bool,
        error: PropTypes.string,
    }),
}
