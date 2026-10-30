import { GeneralLoader } from "@kace/ui-shared"
import { Ban } from "lucide-react"
import PropTypes from "prop-types"
import { useTranslation } from "react-i18next"

const AdminCaseClassificationsHandler = ({ isLoading, notFound, children }) => {
    const { t } = useTranslation()

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[calc(100%-2rem)]" id="adm_case_classifications_loading" data-testid="adm_case_classifications_loading">
                <GeneralLoader />
            </div>
        )
    }

    if (notFound) {
        return (
            <div className="flex justify-center items-center h-[calc(100%-2rem)]">
                <p className="flex flex-col items-center gap-2" id="adm_case_classifications_not_found_message" data-testid="adm_case_classifications_not_found_message">
                    <Ban className="h-10 w-10" />
                    <span>{t("app.text.notFoundClassifications")}</span>
                </p>
            </div>
        )
    }

    return children
}

AdminCaseClassificationsHandler.propTypes = {
    canSee: PropTypes.bool,
    isLoading: PropTypes.bool,
    notFound: PropTypes.bool,
    children: PropTypes.node.isRequired
}

export default AdminCaseClassificationsHandler
