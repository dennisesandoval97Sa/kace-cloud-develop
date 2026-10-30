import { apiService } from "@kace/utils";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const getEmailDownloadUrl = (response) =>
    response?.data?.data?.download_url ??
    response?.data?.data?.downloadUrl ??
    response?.data?.download_url ??
    response?.data?.downloadUrl;

export const downloadEmailZip = async (emailId) => {
    if (!emailId) {
        throw new Error("missing_email_id");
    }

    const response = await apiService.get(`${URL_AND_KEYS.emails.url}/${emailId}/download`);
    const downloadUrl = getEmailDownloadUrl(response);

    if (!downloadUrl) {
        throw new Error("missing_email_download_url");
    }

    window.open(downloadUrl, "_blank", "noopener,noreferrer");
    return downloadUrl;
};
