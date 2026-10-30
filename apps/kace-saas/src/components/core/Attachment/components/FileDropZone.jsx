import { useState, useRef, useEffect } from "react";
import { Button } from "@kace/ui-shared";
import { Download, File, Grab, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../ui-shared/src/lib/utils";
import PropTypes from "prop-types";
import { processFiles } from "@/utils/fileProcessor";

const FileDropZone = ({
    onFilesSelected,
    onDownload,
    onDelete,
    isUploading,
    clearInput,
    multipleFiles,
    files,
    disabled,
    allowedExtensions = [],
    maximunSizeAllowed = 0,
    quantityFilesAllowed = 0,
    showDownload = true,
    onProcessingChange = () => {},
}) => {
    const { t } = useTranslation();
    const [isDragActive, setIsDragActive] = useState(false);
    const inputRef = useRef(null);
    const activeSelectionsRef = useRef(0);
    const maxSizeByte = maximunSizeAllowed * 1024 * 1024;
    const configuredAttachmentLimit = Number(quantityFilesAllowed);
    const hasAttachmentLimit =
        multipleFiles && Number.isFinite(configuredAttachmentLimit) && configuredAttachmentLimit > 0;
    const maximumAttachmentCount = hasAttachmentLimit ? Math.max(0, Math.floor(configuredAttachmentLimit)) : null;
    const isAtCapacity = !disabled && hasAttachmentLimit && files.length >= maximumAttachmentCount;
    const isUploadDisabled = disabled || isAtCapacity;

    const beginProcessing = () => {
        const wasIdle = activeSelectionsRef.current === 0;
        activeSelectionsRef.current += 1;
        if (wasIdle) onProcessingChange(true);
    };

    const finishProcessing = () => {
        activeSelectionsRef.current = Math.max(0, activeSelectionsRef.current - 1);
        if (activeSelectionsRef.current === 0) onProcessingChange(false);
    };

    const processSelectedFiles = async (selectedFiles) => {
        beginProcessing();

        try {
            await processFiles(
                selectedFiles,
                allowedExtensions,
                async (syntheticEvent) => {
                    const validFiles = syntheticEvent.target.files;

                    if (!validFiles || validFiles.length === 0) return;
                    await onFilesSelected(validFiles);
                    handleClearInput();
                },
                () => {},
                () => {},
                maxSizeByte,
            );
        } finally {
            finishProcessing();
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        if (!isUploadDisabled) {
            setIsDragActive(true);
        }
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        setIsDragActive(false);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragActive(false);
        const droppedFiles = event.dataTransfer.files;

        if (!isUploadDisabled && droppedFiles.length > 0) {
            processSelectedFiles(droppedFiles);
        }
    };

    const handleFileChange = (event) => {
        if (!isUploadDisabled && event.target.files.length > 0) {
            processSelectedFiles(event.target.files);
        }
    };

    const handleClearInput = () => {
        const input = inputRef.current;
        if (!input) return;
        input.value = "";
        input.type = "text";
        input.type = "file";
    };

    useEffect(() => {
        clearInput && handleClearInput();
    }, [clearInput]);

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn("relative p-6 text-center border-2 border-dashed rounded-lg border-gray-300", {
                "border-primary": isDragActive && !isUploadDisabled,
                "border-red-300 bg-red-50": isUploadDisabled,
                "opacity-50": isUploadDisabled,
            })}
        >
            <input
                ref={inputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                multiple={multipleFiles}
                disabled={isUploadDisabled}
                accept={allowedExtensions.join(",")}
                data-testid="file_drop_download"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center gap-4 w-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : isDragActive ? (
                    <div className="flex flex-col items-center justify-center gap-4 w-full">
                        <Grab height={40} width={40} />
                        <p className="text-center w-full">{t("app.text.dropFile")}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-4 w-full">
                        {!multipleFiles && files.length > 0 ? (
                            <div className="flex items-center justify-between p-2 bg-gray-100 rounded w-full">
                                <div className="flex items-center">
                                    <File className="mr-2 h-4 w-4" />
                                    <span
                                        className="text-sm truncate max-w-[180px]"
                                        id={`file_drop_${files[0]?.fileData?.name}`}
                                        data-testid={`file_drop_${files[0]?.fileData?.name}`}
                                    >
                                        {files[0]?.path || files[0]?.fileData?.name || t("app.text.unnamedFile")}
                                    </span>
                                </div>
                                <div>
                                    {showDownload && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDownload(files[0]);
                                            }}
                                            type="button"
                                            data-testid="btn_file_upload"
                                            id="btn_file_upload"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTimeout(() => {
                                                onDelete(files[0].id, files[0]);
                                            }, 300);
                                        }}
                                        type="button"
                                        data-testid="btn_cancel_file"
                                        id="btn_cancel_file"
                                    >
                                        <X className="h-4 w-4 text-red-400" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="flex justify-center items-center flex-col text-center w-full">
                                    <Download
                                        height={40}
                                        width={40}
                                        data-testid="icon_drag_drop_file"
                                        id="icon_drag_drop_file"
                                    />
                                    {t("app.text.dragAndDropFile")}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {t("app.text.allowedFormats")}: {allowedExtensions.join(", ")}.
                                    <br />
                                    {t("app.text.maximumSize")}:{" "}
                                    {Math.round(maximunSizeAllowed || import.meta.env.VITE_MAX_FILE_SIZE_MB || 5)} MB
                                    {hasAttachmentLimit && (
                                        <>
                                            <br />
                                            {t("app.text.maximumAttachments")}: {maximumAttachmentCount}
                                        </>
                                    )}
                                </p>
                                {isAtCapacity && (
                                    <p className="text-xs font-medium text-red-600 mt-2" role="alert">
                                        {t("app.text.attachmentLimitReached")}
                                    </p>
                                )}
                            </div>
                        )}
                        {}
                    </div>
                )}
            </label>
        </div>
    );
};

FileDropZone.propTypes = {
    onFilesSelected: PropTypes.func.isRequired,
    onDownload: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    isUploading: PropTypes.bool,
    clearInput: PropTypes.bool,
    multipleFiles: PropTypes.bool,
    files: PropTypes.array,
    disabled: PropTypes.bool,
    allowedExtensions: PropTypes.arrayOf(PropTypes.string),
    maximunSizeAllowed: PropTypes.number,
    quantityFilesAllowed: PropTypes.number,
    onProcessingChange: PropTypes.func,
    showDownload: PropTypes.bool,
};

export default FileDropZone;
