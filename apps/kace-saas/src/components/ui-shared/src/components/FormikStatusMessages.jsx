import PropTypes from "prop-types"

export const FormikStatusMessages = ({ formikStatus }) => {
    if (!formikStatus) {
        return null
    }

    if (Array.isArray(formikStatus)) {
        return (
            <ul className="list-none list-inside bottom-6 left-6 w-full font-semibold text-sm text-redCustom text-center border-redCustom border-2 rounded-md p-2"
                id="formik_status_messages"
                data-testid="formik_status_messages"
            >
                {formikStatus.map((err, index) => (
                    <li key={index} id={`formik_status_message_${index}`} data-testid={`formik_status_message_${index}`}>{err.message}</li>
                ))}
            </ul>
        )
    }

    if (typeof formikStatus === "string") {
        return (
            <ul className="list-none list-inside bottom-6 left-6 w-full font-semibold text-sm text-redCustom text-center border-redCustom border-2 rounded-md p-2" id="formik_status_messages"
                data-testid="formik_status_messages">
                <li id="formik_status_message" data-testid="formik_status_message">{formikStatus}</li>
            </ul>
        )
    }

    return (
        <ul className="list-none list-inside bottom-6 left-6 w-full font-semibold text-sm text-redCustom text-center border-redCustom border-2 rounded-md p-2" id="formik_status_messages"
            data-testid="formik_status_messages">
            <li id="formik_status_message" data-testid="formik_status_message">An unexpected error occurred</li>
        </ul>
    )
}

FormikStatusMessages.propTypes = {
    formikStatus: PropTypes.oneOfType([PropTypes.string, PropTypes.array])
}
