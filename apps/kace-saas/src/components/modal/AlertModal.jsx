import { XMarkIcon } from "@heroicons/react/24/outline"
import { Button } from "@kace/ui"
import PropTypes from "prop-types"

const AlertModal = ({ title, body, bottomRight = null, open, onClickClose, onClickSubmit, loading }) => {
    if (!open) return null
    return (
        <div className="fixed top-0 right-0 inset-0 flex bg-gray-700 bg-opacity-60 items-center justify-center z-40 w-full h-full">
            <div className="bg-card p-6 rounded w-full sm:w-2/3 md:w-2/3 lg:w-1/3 relative grid gap-3 max-w-md">
                <div className="absolute top-0 right-0 m-4">
                    <button className="flex justify-center items-center" onClick={onClickClose}>
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
                <div className="min-h-6 flex items-center font-bold">
                    {title}
                </div>
                <div className="min-h-10 flex items-center justify-center text-sm">
                    {body}
                </div>
                <div className="flex justify-end gap-4">
                    <div>
                        {bottomRight && (
                            <Button
                              className={`${loading ? 'bg-green-200' : 'bg-green-300'} border-green-300 font-medium hover:bg-green-200 hover:border-green-200 py-1 px-4`}
                              onClick={onClickSubmit}
                              disabled={loading}
                            >
                                {bottomRight}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

AlertModal.propTypes = {
    title: PropTypes.string,
    body: PropTypes.string,
    bottomRight: PropTypes.string,
    open: PropTypes.bool,
    onClickClose: PropTypes.func,
    onClickSubmit: PropTypes.func,
    loading: PropTypes.bool
}

export default AlertModal
