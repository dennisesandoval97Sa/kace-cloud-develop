import { Uuid } from "@kace/plugins";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { deleteInformation, requestPut, sendInformation } from "../../../../services/generic-send-information";
import { S3_FILES_DOWNLOAD_SERVICE, S3_FILES_UPLOAD_SERVICE, S3_FILES_VALIDATION_SERVICE } from "../../../../utils/URL";

const useAttachmentsS3 = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    const sendS3Files = useCallback(async (urlS3, content, type) => {
        try {
            const result = await requestPut({
                url: urlS3,
                dataPost: content,
                fileType: type,
            });
            if (result.status !== 200) {
                throw new Error(`Error al subir archivo ${type}`);
            }
        } catch {
            // NO-SONAR: Se lanza un error genérico para manejar cualquier tipo de fallo sin exponer detalles internos.
            throw new Error("upload_error");
        }
    }, []);

    const deleteFile = useCallback(async (id, attachmentService, showMessage = true) => {
        try {
            const response = await deleteInformation(`${attachmentService}/${id}/delete`);
            if (response.status === 200) {
                showMessage && toast.success(t("app.alerts.attachment_deleted"));
                return true;
            }
        } catch {
            // NO-SONAR: Se maneja el error mostrando un mensaje al usuario, y se detiene el flujo
            toast.error(t("app.alerts.delete_error"));
            return false;
        }
    }, []);

    const downloadFile = useCallback(async (attachmentId, file, keyService, showError = true) => {
        try {
            const response = await sendInformation({
                url: S3_FILES_DOWNLOAD_SERVICE,
                dataPost: {
                    fileName: file?.path || file?.fileData?.name,
                    contentType: file?.description || file?.type || file?.tipo || file?.fileData?.type,
                    url: keyService,
                    id: attachmentId || file?.id,
                },
            });
            const uploadUrl = response?.data?.data?.uploadUrl;
            if (!uploadUrl) {
                showError && toast.error(t("app.alerts.download_url_error"));
                return null;
            }
            return uploadUrl;
        } catch {
            // NO-SONAR: Se muestra un error comprensible para el usuario, y se detiene el flujo
            showError && toast.error(t("app.alerts.download_error"));
            return null;
        }
    }, []);

    const getUrlS3File = useCallback(
        async (attachmentId, dataFiles, keyService) => {
            setLoading(true);
            try {
                const url = S3_FILES_UPLOAD_SERVICE;
                const result = await Promise.all(
                    dataFiles.map(async (file) => {
                        const id = attachmentId || Uuid();
                        let response = null;
                        try {
                            response = await sendInformation({
                                url,
                                dataPost: {
                                    fileName: file.name,
                                    contentType: file.type,
                                    url: keyService,
                                    id,
                                },
                            });
                        } catch {
                            // NO-SONAR: Se lanza un error genérico para manejar cualquier tipo de fallo sin exponer detalles internos.
                            throw new Error("upload_error");
                        }

                        const uploadUrl = response?.data?.data?.uploadUrl;
                        if (!uploadUrl) throw new Error("upload_error");

                        await sendS3Files(uploadUrl, file, file.type);

                        await fileValidatorWithAntivirus(keyService, id, file.name);

                        return {
                            id,
                            fileData: file,
                            s3Path: `${keyService}/${id}/${file.name}`,
                        };
                    }),
                );
                return result;
            } catch (err) {
                throw new Error(err?.message || "upload_error");
            } finally {
                setLoading(false);
            }
        },
        [sendS3Files],
    );

    const fileValidatorWithAntivirus = useCallback(async (url, id, fileName) => {
        try {
            const validationResponse = await sendInformation({
                url: `${S3_FILES_UPLOAD_SERVICE}${S3_FILES_VALIDATION_SERVICE}`,
                dataPost: { url, id, fileName },
            });

            if (validationResponse.data?.errors) throw new Error("");
        } catch {
            // NO-SONAR: Si la validación falla, se lanza un error amigable para manejarlo adecuadamente.
            throw new Error("UploadFileErrorSecurity");
        }
    }, []);

    return { getUrlS3File, downloadFile, deleteFile, loading };
};

export default useAttachmentsS3;
