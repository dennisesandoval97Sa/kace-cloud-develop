import JSZip from "jszip";
import { saveAs } from "file-saver";
import { sendInformation } from "@/services/generic-send-information";
import { S3_FILES_DOWNLOAD_SERVICE } from "@/utils/URL";
import { buildS3FileDownloadPayload, getS3SignedDownloadUrl } from "@/utils/s3AttachmentDownload";
import { getAttachmentDisplayName } from "../emails/attachmentDisplayName";

export const downloadAttachmentsZip = async (attachments, zipName = "attachments.zip") => {
    const zip = new JSZip();

    const files = attachments.map(async (file) => {
        const signedUrlResponse = await sendInformation({
            url: S3_FILES_DOWNLOAD_SERVICE,
            dataPost: buildS3FileDownloadPayload(file),
        });
        const signedUrl = getS3SignedDownloadUrl(signedUrlResponse);

        if (!signedUrl) {
            throw new Error("missing_attachment_download_url");
        }

        const response = await fetch(signedUrl);
        const blob = await response.blob();
        zip.file(getAttachmentDisplayName(file), blob);
    });

    await Promise.all(files);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, zipName);
};
