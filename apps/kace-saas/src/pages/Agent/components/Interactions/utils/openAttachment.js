import { sendInformation } from "@/services/generic-send-information";
import { S3_FILES_DOWNLOAD_SERVICE } from "@/utils/URL";
import { buildS3FileDownloadPayload, getS3SignedDownloadUrl } from "@/utils/s3AttachmentDownload";

export const openAttachment = async (file) => {
    const signedUrlResponse = await sendInformation({
        url: S3_FILES_DOWNLOAD_SERVICE,
        dataPost: buildS3FileDownloadPayload(file),
    });
    const signedUrl = getS3SignedDownloadUrl(signedUrlResponse);

    if (!signedUrl) {
        throw new Error("missing_attachment_download_url");
    }

    window.open(signedUrl, "_blank", "noopener,noreferrer");
};
