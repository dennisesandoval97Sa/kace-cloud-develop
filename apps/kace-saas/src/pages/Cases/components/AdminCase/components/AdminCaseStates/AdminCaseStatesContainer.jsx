import PropTypes from "prop-types"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import useAdminCaseUserInfo from "../../hooks/useAdminCaseUserInfo"
import { AdminCaseCardModules } from "../AdminCaseCardModules"
import AdminCaseStatesHandler from "./AdminCaseStatesHandler"
import AdminCaseStateSelector from "./components/AdminCaseStateSelector"
import useAdminCaseStates from "./hooks/useAdminCaseStates"

const AdminCaseStatesContainer = ({ flowId, currentTransition, handleStatus, statusComponent, isOneScript = false }) => {
    const { t } = useTranslation()
    const { userCanEditCase } = useAdminCaseUserInfo()
    const { defaultState, states, isLoading } = useAdminCaseStates(
        flowId,
        currentTransition
    )

    useEffect(() => {
        !isLoading && handleStatus()
    }, [isLoading])

    return (
        <div className="relative h-full w-full">
            {!userCanEditCase && (
                <div className="absolute top-0 right-0 h-full w-full z-50 flex justify-center items-center text-center font-semibold animate-fadeIn hover:bg-gray-400/50 text-transparent hover:text-black cursor-not-allowed rounded-md">
                    {t("text.noEditPermission")}
                </div>
            )}
            <AdminCaseCardModules
                title="app.title.states"
                description="app.text.selectState"
                className="mt-14"
            >
                <AdminCaseStatesHandler isLoading={isLoading}>
                    <AdminCaseStateSelector
                        states={states}
                        defaultState={defaultState}
                        statusComponent={statusComponent}
                        isOneScript={isOneScript}
                    />
                </AdminCaseStatesHandler>
            </AdminCaseCardModules>
        </div>
    )
}

AdminCaseStatesContainer.propTypes = {
    flowId: PropTypes.string,
    currentTransition: PropTypes.string,
    handleStatus: PropTypes.func,
    statusComponent: PropTypes.object,
    isOneScript: PropTypes.bool,
}

export default AdminCaseStatesContainer
