import PropTypes from "prop-types";
import { HELPS_ATTACHMENTS_SERVICE } from "../../../utils/URL";
import AttachmentContainer from "../../../components/core/Attachment/AttachmentContainer";
import useHelpAttachments from "../hooks/useHelpAttachments";
import useGenericSearchQuery from "@kace/hooks/useGenericSearchQuery";

const HelpsAttachments = ({
    helpId,
    deferredUpload = false,
    pendingAttachments = [],
    onPendingAttachmentsChange = () => {},
}) => {
    const { saveAttachmentsHelp } = useHelpAttachments();

    const { data: dataAttachments, isLoading: isLoadingAttachments } = useGenericSearchQuery({
        url: `${HELPS_ATTACHMENTS_SERVICE}/search`,
        keyQuery: "HelpsAttachmentsForm",
        filter: [
            {
                field: "help_id",
                operator: "eq",
                value: helpId,
                type: "AND",
            },
        ],
        select: (data) => data.data,
        enabled: !deferredUpload && !!helpId,
        staleTime: 0,
        gcTime: 0,
    });

    return (
        <AttachmentContainer
            keyService="helps"
            attachmentService={HELPS_ATTACHMENTS_SERVICE}
            attachmentId={helpId}
            saveAttachments={saveAttachmentsHelp}
            currentListAttachments={deferredUpload ? pendingAttachments : (dataAttachments ?? [])}
            handleFiles={deferredUpload ? onPendingAttachmentsChange : undefined}
            isLoadingCurrentListAttachments={deferredUpload ? false : isLoadingAttachments}
            multipleFiles
            allowedFileTypes={[]}
            deferredUpload={deferredUpload}
        />
    );
};

HelpsAttachments.propTypes = {
    helpId: PropTypes.string,
    deferredUpload: PropTypes.bool,
    pendingAttachments: PropTypes.array,
    onPendingAttachmentsChange: PropTypes.func,
};

export default HelpsAttachments;
