import { useTranslation } from "react-i18next"
import useAdminCaseUserInfo from "../../hooks/useAdminCaseUserInfo"
import { AdminCaseCardModules } from "../AdminCaseCardModules"
import AdminCaseClassificationsHandler from "./AdminCaseClassificationsHandler"
import AdminCaseClassificationOptions from "./components/AdminCaseClassificationOptions"
import useAdminCaseClassifications from "./hooks/useAdminCaseClassifications"
import PropTypes from "prop-types"

const AdminCaseClassificationsContainer = ({ handleStatus }) => {
    const { t } = useTranslation()
    const { userCanEditCase } = useAdminCaseUserInfo()
    const {
        classificationsData,
        isLoadingClassifications,
        selectedOptions,
        handleSelectClassification,
        levelKeys
    } = useAdminCaseClassifications(handleStatus)

    return (
        <div className="relative h-full w-full">
            {!userCanEditCase && (
                <div className="absolute top-0 right-0 h-full w-full z-50 flex justify-center items-center text-center font-semibold animate-fadeIn hover:bg-gray-400/50 text-transparent hover:text-black cursor-not-allowed rounded-md" id="admin_case_not_allowed_classifications" data-testid="admin_case_not_allowed_classifications">
                    {t("text.noEditPermission")}
                </div>
            )}
            <AdminCaseCardModules
                title="app.title.classifications"
                description="app.text.selectClassification"
                id="admin_case_classifications_loading"
                data-testid="admin_case_classifications_loading"
            >
                <AdminCaseClassificationsHandler
                    isLoading={isLoadingClassifications}
                    notFound={!classificationsData?.length}
                    id="admin_case_classifications_handler"
                    data-testid="admin_case_classifications_handler"
                >
                    {classificationsData?.length > 0 && (
                        <AdminCaseClassificationOptions
                            options={classificationsData}
                            selectedOptions={selectedOptions}
                            handleSelect={handleSelectClassification}
                            classifications={levelKeys}
                        />
                    )}
                </AdminCaseClassificationsHandler>
            </AdminCaseCardModules>
        </div>
    )
}

AdminCaseClassificationsContainer.propTypes = {
    handleStatus: PropTypes.func
}

export default AdminCaseClassificationsContainer
