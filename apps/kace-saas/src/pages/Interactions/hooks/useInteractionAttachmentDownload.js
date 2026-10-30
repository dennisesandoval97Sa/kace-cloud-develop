import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { sendInformation } from "@/services/generic-send-information";
import { S3_FILES_DOWNLOAD_SERVICE } from "@/utils/URL";
import { buildS3FileDownloadPayload, getS3SignedDownloadUrl } from "@/utils/s3AttachmentDownload";

export const buildInteractionAttachmentDownloadPayload = buildS3FileDownloadPayload;

const MISSING_ATTACHMENT_DOWNLOAD_URL_ERROR = "missing_attachment_download_url";

const getFirstDownloadApiError = (errors) => {
    if (typeof errors === "string") {
        return errors;
    }

    if (Array.isArray(errors)) {
        return errors[0]?.message ?? errors[0];
    }

    return null;
};

const getInteractionAttachmentDownloadErrorMessage = (error, t) => {
    const rawMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        getFirstDownloadApiError(error?.response?.data?.errors) ||
        error?.message;
    const message = typeof rawMessage === "string" ? rawMessage : String(rawMessage ?? "");

    if (message && message !== MISSING_ATTACHMENT_DOWNLOAD_URL_ERROR) {
        return message;
    }

    return t("app.alerts.download_error");
};

export const useInteractionAttachmentDownload = () => {
    const { t } = useTranslation();

    const openAttachment = useCallback(
        async (attachment) => {
            try {
                const response = await sendInformation({
                    url: S3_FILES_DOWNLOAD_SERVICE,
                    dataPost: buildInteractionAttachmentDownloadPayload(attachment),
                });
                const signedUrl = getS3SignedDownloadUrl(response);

                if (!signedUrl) {
                    throw new Error("missing_attachment_download_url");
                }

                window.open(signedUrl, "_blank", "noopener,noreferrer");
                return signedUrl;
            } catch (error) {
                toast.error(getInteractionAttachmentDownloadErrorMessage(error, t));
                return null;
            }
        },
        [t],
    );

    return { openAttachment };
};
