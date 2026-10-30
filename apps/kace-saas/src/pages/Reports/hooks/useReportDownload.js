import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { sendInformation } from "@/services/generic-send-information";
import { S3_FILES_DOWNLOAD_SERVICE } from "@/utils/URL";

const extractDirectory = (s3Path) => {
    if (!s3Path) return "";
    const parts = s3Path.split("/");
    parts.pop();
    return parts.join("/");
};

const extractFileName = (s3Path) => {
    if (!s3Path) return "report.xlsx";
    const parts = s3Path.split("/");
    return parts[parts.length - 1] || "report.xlsx";
};

const parseS3Location = (s3Location) => {
    if (!s3Location) return "";

    if (!s3Location.startsWith("s3://")) {
        return s3Location;
    }

    const parts = s3Location.replace("s3://", "").split("/");
    parts.shift();
    return parts.join("/");
};

export const useReportDownload = () => {
    const { t } = useTranslation();
    const [isDownloading, setIsDownloading] = useState(false);

    const downloadReport = useCallback(
        async (reportData) => {
            if (isDownloading) return;

            try {
                setIsDownloading(true);

                const s3Location = reportData?.result?.s3Location || reportData?.s3_file || reportData?.s3File;

                if (!s3Location) {
                    if (reportData?.result?.presignedUrl) {
                        window.open(reportData.result.presignedUrl, "_blank", "noopener,noreferrer");
                        toast.dismiss();
                        toast.success(t("reports.download.success"));
                        setIsDownloading(false);
                        return;
                    }
                    toast.error(t("reports.download.error"));
                    setIsDownloading(false);
                    return;
                }

                toast.loading(t("reports.download.generating"));

                const s3Path = parseS3Location(s3Location);
                const fileName = extractFileName(s3Path);

                const directory = extractDirectory(s3Path);

                const response = await sendInformation({
                    url: S3_FILES_DOWNLOAD_SERVICE,
                    dataPost: {
                        fileName,
                        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        url: directory,
                    },
                });

                const downloadUrl = response?.data?.data?.uploadUrl;
                if (!downloadUrl) {
                    throw new Error("No se pudo obtener la URL de descarga");
                }

                window.open(downloadUrl, "_blank", "noopener,noreferrer");

                toast.dismiss();
                toast.success(t("reports.download.success"));
            } catch (error) {
                toast.dismiss();
                toast.error(error?.response?.data?.message || error?.message || t("reports.download.error"));
            } finally {
                setIsDownloading(false);
            }
        },
        [t, isDownloading],
    );

    return { downloadReport, isDownloading };
};
