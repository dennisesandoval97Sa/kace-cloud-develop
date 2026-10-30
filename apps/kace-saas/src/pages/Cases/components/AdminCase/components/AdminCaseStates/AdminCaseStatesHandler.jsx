import { GeneralLoader } from "@kace/ui-shared"
import PropTypes from "prop-types"
import { useMemo } from "react"
import useAdminCaseCacheData from "../../hooks/useAdminCaseCacheData"
import useAdminCaseUserInfo from "../../hooks/useAdminCaseUserInfo"
import AdminCaseCaseStatusIndicator from "./components/AdminCaseCaseStatusIndicator"
import { useTranslation } from "react-i18next"

const AdminCaseStatesHandler = ({ isLoading, children }) => {
    const { t } = useTranslation()
    const { userCanEditCase } = useAdminCaseUserInfo()
    const { caseCacheData } = useAdminCaseCacheData()

    const solvedDate = useMemo(
        () => caseCacheData?.fecha_resolucion,
        [caseCacheData?.fecha_resolucion]
    )

    if (isLoading) {
        return <GeneralLoader />
    }

    if (solvedDate) {
        return (
            <AdminCaseCaseStatusIndicator
                title="text.caseIsClosed"
                dateTime={solvedDate}
            />
        )
    }

    return (
        <div>
            {!userCanEditCase && (
                <div className="absolute top-0 right-0 h-full w-full z-50 flex justify-center items-center text-center font-semibold animate-fadeIn hover:bg-gray-400/50 text-transparent hover:text-black cursor-not-allowed rounded-md">
                    {t("text.noEditPermission")}
                </div>
            )}
            {children}
        </div>
    )
}

AdminCaseStatesHandler.propTypes = {
    caseManagerId: PropTypes.string,
    isLoading: PropTypes.bool,
    children: PropTypes.node.isRequired
}

export default AdminCaseStatesHandler
