import { sendInformation } from "@/services/generic-send-information";
import { S3_FILES_DOWNLOAD_SERVICE } from "@/utils/URL";
import { buildS3FileDownloadPayload, getS3SignedDownloadUrl } from "@/utils/s3AttachmentDownload";
import { getAttachmentDisplayName } from "../emails/attachmentDisplayName";

export const downloadAttachment = async (file) => {
    const signedUrlResponse = await sendInformation({
        url: S3_FILES_DOWNLOAD_SERVICE,
        dataPost: buildS3FileDownloadPayload(file),
    });
    const signedUrl = getS3SignedDownloadUrl(signedUrlResponse);

    if (!signedUrl) {
        throw new Error("missing_attachment_download_url");
    }

    // A failed fetch rejects here and propagates to the caller (EmailDetail shows a
    // toast), so link.click() below only runs on success — no extra try/catch needed.
    const response = await fetch(signedUrl);
    const blob = await response.blob();

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = getAttachmentDisplayName(file);
    document.body.appendChild(link);
    link.click();

    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
};
