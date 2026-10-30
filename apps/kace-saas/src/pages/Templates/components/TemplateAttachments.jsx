import PropTypes from "prop-types";
import { TEMPLATES_ATTACHMENT_SERVICE } from "../../../utils/URL";
import AttachmentContainer from "../../../components/core/Attachment/AttachmentContainer";
import useGenericSearchQuery from "@kace/hooks/useGenericSearchQuery";

const TemplateAttachments = ({
    templateId,
    isActive = false,
    pendingFiles = [],
    onPendingFilesChange = () => {},
    onPendingFilesProcessingChange = () => {},
    saveAttachmentsTemplate,
}) => {
    /*
     * Without a persisted template id (create mode) files are only queued
     * locally; they are uploaded after the template is created and the
     * server-generated id is known.
     */
    const isDeferred = !templateId;

    const { data: dataAttachments, isLoading: isLoadingAttachments } = useGenericSearchQuery({
        url: `${TEMPLATES_ATTACHMENT_SERVICE}/search`,
        keyQuery: "TemplatesAttachmentsForm",
        filter: [
            {
                field: "template_id",
                operator: "eq",
                value: templateId,
                type: "AND",
            },
            {
                field: "usage_type",
                operator: "neq",
                value: "inline",
                type: "AND",
            },
        ],
        select: (data) => data.data,
        enabled: !!templateId,
        staleTime: 0,
        gcTime: 0,
    });

    return (
        <div className="relative">
            {!isActive === "false" ||
                (!isActive && (
                    <div className="absolute top-0 right-0 h-full w-full z-50 flex justify-center items-center text-center font-semibold animate-fadeIn rounded-md cursor-not-allowed text-transparent bg-gray-400/50 text-black" />
                ))}
            <AttachmentContainer
                keyService="template"
                attachmentService={TEMPLATES_ATTACHMENT_SERVICE}
                attachmentId={templateId}
                saveAttachments={saveAttachmentsTemplate}
                currentListAttachments={isDeferred ? pendingFiles : dataAttachments}
                isLoadingCurrentListAttachments={!isDeferred && isLoadingAttachments}
                deferredUpload={isDeferred}
                handleFiles={onPendingFilesChange}
                onProcessingChange={onPendingFilesProcessingChange}
                multipleFiles
                disabled={!isActive}
            />
        </div>
    );
};

TemplateAttachments.propTypes = {
    templateId: PropTypes.string,
    isActive: PropTypes.bool,
    pendingFiles: PropTypes.array,
    onPendingFilesChange: PropTypes.func,
    onPendingFilesProcessingChange: PropTypes.func,
    saveAttachmentsTemplate: PropTypes.func.isRequired,
};

export default TemplateAttachments;
