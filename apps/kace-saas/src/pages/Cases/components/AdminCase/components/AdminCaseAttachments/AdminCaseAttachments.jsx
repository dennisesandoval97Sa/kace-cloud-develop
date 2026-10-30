import AttachmentContainer from "../../../../../../components/core/Attachment/AttachmentContainer"
import PropTypes from "prop-types"
import { URL_AND_KEYS } from "../../../../../../utils/urlAndKeys"
import useAdminCaseAttachments from "./hooks/useAdminCaseAttachments"
import { AdminCaseCardModules } from "../AdminCaseCardModules"
import { useTranslation } from "react-i18next"
import useAdminCaseUserInfo from "../../hooks/useAdminCaseUserInfo"

const AdminCaseAttachments = ({ caseId }) => {
    const { t } = useTranslation()
    const { saveAttachmentsCase, dataAttachments, isLoadingAttachments } =
        useAdminCaseAttachments()
    const { userCanEditCase } = useAdminCaseUserInfo()

    return (
        <div className="relative h-full w-full">
            <AdminCaseCardModules
                title="app.title.attachments"
                className="flex justify-center items-center"
            >
                <AttachmentContainer
                    keyService="case"
                    attachmentService={URL_AND_KEYS.cases.urlAttachments}
                    attachmentId={caseId}
                    saveAttachments={saveAttachmentsCase}
                    currentListAttachments={dataAttachments}
                    isLoadingCurrentListAttachments={isLoadingAttachments}
                    multipleFiles
                    allowedFileTypes={["images"]}
                    readOnly={!userCanEditCase}
                />
            </AdminCaseCardModules>
        </div>
    )
}

AdminCaseAttachments.propTypes = {
    caseId: PropTypes.string.isRequired
}

export default AdminCaseAttachments
