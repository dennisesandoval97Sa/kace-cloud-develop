import { sendInformation } from "../../../services/generic-send-information";
import { HELPS_ATTACHMENTS_SERVICE } from "../../../utils/URL";
import useAttachmentsS3 from "../../../components/core/Attachment/hooks/useAttachmentsS3";
import { findPublicErrorCode, PUBLIC_ERROR_CODES } from "@kace/error-codes";

const failedAttachment = (attachment, error) => {
    const errorCode = findPublicErrorCode(error?.response?.data?.data?.code, error?.response?.data?.code);

    return {
        ...attachment,
        status: "failed",
        errorCode,
        errorReason:
            errorCode === PUBLIC_ERROR_CODES.HELP_ATTACHMENT_FILENAME_REJECTED ? "filename_rejected" : "upload_error",
    };
};

const useHelpAttachments = () => {
    const { getUrlS3File } = useAttachmentsS3();

    const saveAttachmentsHelp = async (idHelp, files) => {
        const url = `${HELPS_ATTACHMENTS_SERVICE}`;
        const dataPosts = files.map((file) => ({
            help_id: idHelp,
            path: file.fileData.name,
            tipo: file.fileData.type,
        }));

        const results = await Promise.all(
            dataPosts.map(async (dataPost, index) => {
                const data = { id: null, url, dataPost };
                const result = await sendInformation(data);
                if (result.status === 200 || result.status === 201) {
                    const attachmentId = result?.data?.data?.id ?? result?.data?.id;
                    if (!attachmentId) throw new Error("missing_attachment_id");

                    return {
                        ...dataPost,
                        id: attachmentId,
                        fileData: files[index].fileData,
                    };
                }

                throw new Error("attachment_save_error");
            }),
        );

        return results;
    };

    const uploadPendingAttachments = async (helpId, pendingAttachments) => {
        const attachmentsToUpload = pendingAttachments.filter((attachment) => attachment.status !== "success");
        const uploadResults = await Promise.allSettled(
            attachmentsToUpload.map(async (attachment) => {
                const uploadedFiles = await getUrlS3File(helpId, [attachment.fileData], "helps");
                if (!uploadedFiles.length) throw new Error("upload_error");
                const [savedAttachment] = await saveAttachmentsHelp(helpId, uploadedFiles);
                return {
                    ...attachment,
                    ...savedAttachment,
                    fileData: attachment.fileData,
                    status: "success",
                    errorCode: undefined,
                    errorReason: undefined,
                };
            }),
        );

        let uploadIndex = 0;
        return pendingAttachments.map((attachment) => {
            if (attachment.status === "success") return attachment;

            const result = uploadResults[uploadIndex++];
            return result.status === "fulfilled" ? result.value : failedAttachment(attachment, result.reason);
        });
    };

    return { saveAttachmentsHelp, uploadPendingAttachments };
};

export default useHelpAttachments;
