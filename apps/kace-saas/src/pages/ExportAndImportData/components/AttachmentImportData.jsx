import { Uuid } from "@kace/plugins";
import { Download, Loader2 } from "lucide-react";
import PropTypes from "prop-types";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getAllowedExtensions, processFiles } from "../../../utils/fileProcessor";
import { IMPORTS_SERVICE, S3_FILES_UPLOAD_SERVICE } from "../../../utils/URL";
import { sendInformation } from "../../../services/generic-send-information";
import { sendS3Files, fileValidatorWithAntivirus } from "../../../utils/attachments";
import { useQueryClient } from "@tanstack/react-query";
import { getMimeTypeFromExtension } from "../../../utils/fileValidations";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useTranslation } from "react-i18next";

const allowedCategories = ["csv"];

const allowedFileTypes = ["text/csv"];
const s3ObjectKey = "importData";

export const AttachmentImportData = ({ moduleSelected }) => {
    const queryClient = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const fileInputRef = useRef(null);
    const { t } = useTranslation();
    const handleProcessedFiles = (event) => {
        if (event.target && event.target.files) {
            if (event.target.files.length > 1) {
                toast.warning(t("importExport.form.onlyOneFile"));
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
                return;
            }

            if (event.target.files.length === 1) {
                handleFiles([event.target.files[0]]);
                queryClient.invalidateQueries({
                    queryKey: [URL_AND_KEYS.importsDashboard.key],
                });
            }
        }
    };

    const getUrlS3File = async (dataFiles, id, t = null, newFields = null) => {
        try {
            const url = S3_FILES_UPLOAD_SERVICE;
            const result = await Promise.all(
                dataFiles.map(async (file) => {
                    let response = null;
                    try {
                        response = await sendInformation({
                            url,
                            dataPost: {
                                fileName: file.fileName,
                                contentType: file.contentType,
                                url: s3ObjectKey,
                                id,
                            },
                        });
                    } catch {
                        // NO-SONAR: Si ocurre un error se lanza un error amigable para manejarlo adecuadamente.
                        throw new Error("upload_error");
                    }
                    const uploadUrl = response?.data?.data?.uploadUrl;
                    if (!uploadUrl) throw new Error("upload_error");

                    const contentFile = new Blob([new Uint8Array(file.content)], { type: file.contentType });

                    await sendS3Files(uploadUrl, contentFile, file.contentType);

                    await fileValidatorWithAntivirus(s3ObjectKey, id, file.fileName);
                    await sendInformation({
                        url: IMPORTS_SERVICE,
                        dataPost: {
                            presignedUrl: uploadUrl,
                            targetTable: newFields?.targetTable,
                        },
                    });
                }),
            );
            return result;
        } catch {
            // NO-SONAR: Se maneja el error mostrando un mensaje amigable al usuario a través del toast
            toast.error(t("app.alerts.UploadFileError"));
        }
    };

    const handleFiles = async (acceptedFiles = []) => {
        const file = acceptedFiles[0];
        const normalizedContentType = file.type || getMimeTypeFromExtension(file.name);

        if (!allowedFileTypes.includes(normalizedContentType)) {
            toast.warning(t("importExport.form.onlyCsvFiles"));
            return;
        }

        setIsUploading(true);

        try {
            const fileContent = new Uint8Array(await file.arrayBuffer());

            const fileData = {
                fileName: file.name,
                contentType: normalizedContentType,
                content: Array.from(fileContent),
            };
            const id = Uuid();

            await getUrlS3File([fileData], id, null, {
                isForImport: true,
                targetTable: moduleSelected,
            });

            toast.success(t("importExport.form.fileUploaded"));
        } catch (error) {
            toast.error(`Error al subir adjunto: ${error}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        setIsDragActive(true);
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        setIsDragActive(false);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragActive(false);
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            processFiles(
                event.dataTransfer.files,
                allowedCategories,
                handleProcessedFiles,
                () => setIsValidating(true),
                () => setIsValidating(false),
            );
        }
    };

    const handleFileChange = (event) => {
        if (event.target.files && event.target.files.length > 0) {
            processFiles(
                event.target.files,
                allowedCategories,
                handleProcessedFiles,
                () => setIsValidating(true),
                () => setIsValidating(false),
            );
        }
    };

    const allowedExtensions = getAllowedExtensions(allowedCategories);

    return (
        <div className="p-4 m-2 max-w-2/4">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative p-6 text-center border-2 border-dashed rounded-lg ${isDragActive ? "border-primary" : "border-gray-300"}`}
            >
                <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    ref={fileInputRef}
                    accept={allowedExtensions.join(",")}
                    disabled={isUploading || !moduleSelected}
                    data-testid="attachment_file_upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer" data-testid="file_upload" id="file_upload">
                    {isUploading || isValidating ? (
                        <div className="w-full flex justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : isDragActive ? (
                        <p>{t("app.text.dropFile")}</p>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <Download height={40} width={40} />
                            <div>
                                <p>{t("app.text.dragAndDropFile")}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {t("importExport.form.onlyCsvFiles")} {t("app.text.maximumSize")}:{" "}
                                    {Math.round(import.meta.env.VITE_MAX_FILE_SIZE_MB || 5)} MB
                                </p>
                            </div>
                        </div>
                    )}
                </label>
            </div>
        </div>
    );
};

AttachmentImportData.propTypes = {
    moduleSelected: PropTypes.string,
};
