import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { Uuid } from "@kace/plugins";
import useAttachmentsS3 from "./useAttachmentsS3";
import { getAllowedExtensions, processFiles } from "../utils/fileProcessor";
import { getTranslatedError } from "@/utils/getTranslatedError";

const useAttachmentsActions = ({
    currentListAttachments,
    keyService,
    attachmentService,
    attachmentId,
    allowedFileTypes,
    multipleFiles,
    handleFiles,
    saveAttachments,
    disabled,
    deferredUpload = false,
    allowedFileExtensions,
    maximunSizeAllowed,
    quantityFilesAllowed,
    ignoreTenantExtensions = false,
}) => {
    const { t } = useTranslation();
    const [listAttachment, setListAttachment] = useState(currentListAttachments);
    const listAttachmentRef = useRef(currentListAttachments);
    const [isUploading, setIsUploading] = useState(false);
    const activeUploadsRef = useRef(0);
    const reservedAttachmentSlotsRef = useRef(0);

    const { getUrlS3File, downloadFile, deleteFile } = useAttachmentsS3();

    const routeAllowedExtensions = getAllowedExtensions(
        allowedFileTypes && allowedFileTypes.length > 0 ? allowedFileTypes : null,
    );
    const configuredAllowedExtensions = Array.isArray(allowedFileExtensions)
        ? allowedFileExtensions
        : routeAllowedExtensions;

    /**
     * Política de resolución de extensiones permitidas:
     * - Por defecto se aplica la semántica estricta del backend: si la ruta define tipos, se aplica la
     *   intersección con las extensiones configuradas por el tenant; si la ruta no define tipos específicos,
     *   se aplican las extensiones del tenant. Si el tenant tiene lista vacía ([]) o no existe solape,
     *   no se permite ninguna extensión (alineado con isAllowedExtension).
     * - Si se habilita el opt-out explícito (ignoreTenantExtensions), prevalecen las extensiones
     *   requeridas por la ruta (routeAllowedExtensions). Reservado exclusivamente para flujos
     *   especializados (como Massive Execution con .csv) cuyo backend no aplica la lista del tenant.
     */
    const allowedExtensions = ignoreTenantExtensions
        ? routeAllowedExtensions
        : allowedFileTypes && allowedFileTypes.length > 0
          ? configuredAllowedExtensions.filter((extension) => routeAllowedExtensions.includes(extension))
          : configuredAllowedExtensions;
    const configuredMaximumSize = Number(maximunSizeAllowed);
    const maximumSizeInBytes = Number.isFinite(configuredMaximumSize)
        ? Math.max(0, configuredMaximumSize) * 1024 * 1024
        : undefined;
    const configuredAttachmentLimit = Number(quantityFilesAllowed);
    const maximumAttachmentCount =
        Number.isFinite(configuredAttachmentLimit) && configuredAttachmentLimit > 0
            ? Math.max(0, Math.floor(configuredAttachmentLimit))
            : Number.POSITIVE_INFINITY;

    const updateAttachmentList = (getUpdatedAttachments) => {
        const updatedAttachments = getUpdatedAttachments(listAttachmentRef.current);
        listAttachmentRef.current = updatedAttachments;
        setListAttachment(updatedAttachments);
        handleFiles(updatedAttachments);
    };

    const beginUpload = () => {
        const wasIdle = activeUploadsRef.current === 0;
        activeUploadsRef.current += 1;
        if (wasIdle) {
            setIsUploading(true);
        }
    };

    const finishUpload = () => {
        activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
        if (activeUploadsRef.current === 0) {
            setIsUploading(false);
        }
    };

    const handleUpload = async (files) => {
        beginUpload();
        let reservedAttachmentSlots = 0;

        try {
            if (disabled) throw new Error("noFileAttachments");

            const validFiles = await processFiles(files, allowedExtensions, maximumSizeInBytes);

            if (!validFiles?.length) return;

            let remainingAttachmentSlots = validFiles.length;
            if (multipleFiles && Number.isFinite(maximumAttachmentCount)) {
                remainingAttachmentSlots = Math.max(
                    0,
                    maximumAttachmentCount - listAttachmentRef.current.length - reservedAttachmentSlotsRef.current,
                );
            }
            const acceptedFiles = validFiles.slice(0, remainingAttachmentSlots);
            const rejectedFileCount = validFiles.length - acceptedFiles.length;

            if (rejectedFileCount > 0) {
                toast.warning(
                    t("app.alerts.attachmentLimitExceeded", {
                        maximum: maximumAttachmentCount,
                        rejected: rejectedFileCount,
                    }),
                );
            }

            if (!acceptedFiles.length) return;

            if (multipleFiles && Number.isFinite(maximumAttachmentCount)) {
                reservedAttachmentSlots = acceptedFiles.length;
                reservedAttachmentSlotsRef.current += reservedAttachmentSlots;
            }

            if (deferredUpload) {
                /*
                 * The owning resource does not exist yet (e.g. template creation):
                 * queue the validated files locally; the caller uploads them once the
                 * server-generated resource id is known. The id here is only a local
                 * list key, it is never sent to the API.
                 */
                const queuedFiles = acceptedFiles.map((file) => ({
                    id: Uuid(),
                    path: file.name,
                    tipo: file.type,
                    fileData: file,
                    pending: true,
                    status: "pending",
                }));
                updateAttachmentList((currentAttachments) =>
                    multipleFiles ? [...queuedFiles, ...currentAttachments] : queuedFiles,
                );
                toast.success(t("app.alerts.attachment_queued"));
                return;
            }

            const response = await getUrlS3File(attachmentId, acceptedFiles, keyService);
            if (!response.length) throw new Error("upload_error");

            const data = await saveAttachments(attachmentId, response);

            if (!multipleFiles && attachmentService) {
                const prevAttachments = listAttachmentRef.current[0]?.id;
                if (prevAttachments) {
                    const isDeleted = await deleteFile(prevAttachments, attachmentService, false);
                    if (!isDeleted) return;
                }
            }

            updateAttachmentList((currentAttachments) =>
                multipleFiles ? [...(data || response), ...currentAttachments] : data || response,
            );

            toast.success(t("app.alerts.upload_success"));
        } catch (error) {
            const apiErrorMessage = error?.response?.data ? getTranslatedError(error, t) : undefined;
            toast.error(apiErrorMessage || t(`app.alerts.upload_error`));
        } finally {
            reservedAttachmentSlotsRef.current = Math.max(
                0,
                reservedAttachmentSlotsRef.current - reservedAttachmentSlots,
            );
            finishUpload();
        }
    };

    const handleDownload = async (file) => {
        if ((file?.pending || file?.status === "pending") && file?.fileData) {
            // Queued file that has not been uploaded yet: preview it locally.
            const objectUrl = URL.createObjectURL(file.fileData);
            window.open(objectUrl, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
            return;
        }
        const response = await downloadFile(attachmentId, file, keyService);
        if (response) {
            window.open(response, "_blank", "noopener,noreferrer");
        }
    };

    const removeAttachment = (id) => {
        updateAttachmentList((currentAttachments) => currentAttachments.filter((file) => file.id !== id));
    };

    const handleDelete = async (id, attachment) => {
        const isPersistedAttachment = !deferredUpload || attachment?.status === "success";

        if (isPersistedAttachment && attachmentService) {
            const isDeleted = await deleteFile(id, attachmentService);
            if (!isDeleted) return;
            removeAttachment(id);
            return;
        }

        removeAttachment(id);
    };

    useEffect(() => {
        const isAlreadySynchronized =
            listAttachmentRef.current.length === currentListAttachments.length &&
            listAttachmentRef.current.every((attachment, index) => attachment === currentListAttachments[index]);
        if (isAlreadySynchronized) return;

        listAttachmentRef.current = currentListAttachments;
        setListAttachment(currentListAttachments);
    }, [currentListAttachments]);

    return {
        listAttachment,
        isUploading,
        allowedExtensions,
        handleUpload,
        handleDownload,
        handleDelete,
    };
};

useAttachmentsActions.propTypes = {
    currentListAttachments: PropTypes.array.isRequired,
    keyService: PropTypes.string.isRequired,
    attachmentService: PropTypes.string.isRequired,
    attachmentId: PropTypes.string.isRequired,
    allowedFileTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
    multipleFiles: PropTypes.bool.isRequired,
    handleFiles: PropTypes.func.isRequired,
    saveAttachments: PropTypes.func.isRequired,
    disabled: PropTypes.bool.isRequired,
    deferredUpload: PropTypes.bool,
    allowedFileExtensions: PropTypes.arrayOf(PropTypes.string),
    maximunSizeAllowed: PropTypes.number,
    quantityFilesAllowed: PropTypes.number,
    ignoreTenantExtensions: PropTypes.bool,
};

export default useAttachmentsActions;
