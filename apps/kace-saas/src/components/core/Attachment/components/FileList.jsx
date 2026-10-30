import { Download, X, File, ImageOff, Loader2 } from "lucide-react";
import { Button, ScrollArea } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { getTranslatedPublicErrorCode } from "@/utils/getTranslatedError";

const FileList = ({ files, onDownload, onDelete, isLoading, readOnly = false, showDownload = true }) => {
    const { t } = useTranslation();
    return (
        <ScrollArea className="h-60 mt-2">
            <ul className="space-y-2">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-4 w-full h-52">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex flex-col gap-4 h-52 items-center justify-center text-center font-semibold">
                        <ImageOff height={50} width={50} />{" "}
                        <p className="text-gray-500">{t("app.text.noAttachments")}</p>
                    </div>
                ) : (
                    files.map((file) => {
                        const errorMessage =
                            file.status === "failed"
                                ? getTranslatedPublicErrorCode(file.errorCode, t) || t("app.alerts.upload_error")
                                : undefined;

                        return (
                            <li
                                key={file.id}
                                className="flex items-center justify-between p-2 bg-gray-100 rounded"
                                id="file_list_item"
                                data-testid="file_list_item"
                            >
                                <div className="flex items-center min-w-0">
                                    <File className="mr-2 h-4 w-4 shrink-0" />
                                    <div className="flex min-w-0 flex-col">
                                        <span className="text-sm truncate max-w-[180px]">
                                            {file?.path || file?.fileData?.name || t("app.text.unnamedFile")}
                                        </span>
                                        {errorMessage && <span className="text-xs text-red-600">{errorMessage}</span>}
                                    </div>
                                </div>
                                <div>
                                    {(showDownload || file.status === "success") && file.status !== "failed" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDownload(file)}
                                            type="button"
                                            id="btn_file_list_download"
                                            data-testid="btn_file_list_download"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {!readOnly && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDelete(file.id, file)}
                                            type="button"
                                            id="btn_file_list_delete"
                                            data-testid="btn_file_list_delete"
                                        >
                                            <X
                                                className="h-4 w-4 text-red-400"
                                                id="file_list_cancel"
                                                data-testid="file_list_cancel"
                                            />
                                        </Button>
                                    )}
                                </div>
                            </li>
                        );
                    })
                )}
            </ul>
        </ScrollArea>
    );
};

FileList.propTypes = {
    files: PropTypes.array.isRequired,
    onDownload: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    isLoading: PropTypes.bool.isRequired,
    readOnly: PropTypes.bool,
    showDownload: PropTypes.bool,
};

export default FileList;
