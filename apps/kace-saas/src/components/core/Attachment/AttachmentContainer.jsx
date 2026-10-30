import FileDropZone from "./components/FileDropZone";
import FileList from "./components/FileList";
import PropTypes from "prop-types";
import useAttachmentsActions from "./hooks/useAttachmentsActions";
import useConfigAgentData from "@/hooks/useConfigAgentData";

const EMPTY_ATTACHMENTS = [];

const AttachmentContainer = ({
    currentListAttachments = EMPTY_ATTACHMENTS,
    keyService,
    attachmentService = "",
    attachmentId = "",
    allowedFileTypes = [],
    multipleFiles = false,
    handleFiles = () => {},
    saveAttachments = () => {},
    clearInput = false,
    isLoadingCurrentListAttachments = false,
    disabled,
    readOnly = false,
    deferredUpload = false,
    onProcessingChange = () => {},
    ignoreTenantExtensions = false,
}) => {
    const {
        allowed_file_extensions: allowedExtensions,
        maximun_size_allowed: maximunSizeAllowed,
        quantity_files_allowed: quantityFilesAllowed,
        isLoading: isLoadingConfiguration,
        isFetching: isFetchingConfiguration,
    } = useConfigAgentData();
    const isUploadDisabled =
        disabled ||
        readOnly ||
        isLoadingConfiguration ||
        isFetchingConfiguration ||
        (multipleFiles && isLoadingCurrentListAttachments);

    const {
        handleUpload,
        handleDelete,
        handleDownload,
        listAttachment,
        isUploading,
        allowedExtensions: effectiveAllowedExtensions,
    } = useAttachmentsActions({
        currentListAttachments,
        keyService,
        attachmentService,
        attachmentId,
        allowedFileTypes,
        multipleFiles,
        handleFiles,
        saveAttachments,
        disabled: isUploadDisabled,
        deferredUpload,
        allowedFileExtensions: allowedExtensions,
        maximunSizeAllowed,
        quantityFilesAllowed,
        ignoreTenantExtensions,
    });

    return (
        <div className="p-4 m-2">
            <FileDropZone
                onFilesSelected={handleUpload}
                onDownload={handleDownload}
                onDelete={handleDelete}
                isUploading={isUploading}
                clearInput={clearInput}
                multipleFiles={multipleFiles}
                files={listAttachment}
                disabled={isUploadDisabled}
                allowedExtensions={effectiveAllowedExtensions}
                maximunSizeAllowed={maximunSizeAllowed}
                quantityFilesAllowed={quantityFilesAllowed}
                onProcessingChange={onProcessingChange}
                showDownload={!deferredUpload || listAttachment[0]?.status === "success"}
            />
            {multipleFiles && (
                <FileList
                    files={listAttachment}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    isLoading={isLoadingCurrentListAttachments}
                    readOnly={readOnly}
                    showDownload={!deferredUpload}
                />
            )}
        </div>
    );
};

AttachmentContainer.propTypes = {
    currentListAttachments: PropTypes.array,
    keyService: PropTypes.string.isRequired,
    attachmentService: PropTypes.string,
    attachmentId: PropTypes.string,
    allowedFileTypes: PropTypes.arrayOf(PropTypes.string),
    multipleFiles: PropTypes.bool,
    handleFiles: PropTypes.func,
    saveAttachments: PropTypes.func,
    clearInput: PropTypes.bool,
    isLoadingCurrentListAttachments: PropTypes.bool,
    disabled: PropTypes.bool,
    readOnly: PropTypes.bool,
    deferredUpload: PropTypes.bool,
    onProcessingChange: PropTypes.func,
    ignoreTenantExtensions: PropTypes.bool,
};

export default AttachmentContainer;
