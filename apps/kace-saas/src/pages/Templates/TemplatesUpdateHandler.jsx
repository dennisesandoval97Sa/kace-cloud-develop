import { GeneralLoader } from "@kace/ui-shared";
import { removeKey } from "@kace/utils";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import useAttachmentsS3 from "../../components/core/Attachment/hooks/useAttachmentsS3";
import useTemplateAttachments from "./hooks/useTemplateAttachments";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";
import { sendInformation } from "../../services/generic-send-information";
import { genericView } from "../../services/genericView";
import { TEMPLATES_SERVICE } from "../../utils/URL";
import TemplatesForm from "./components/TemplatesForm";
import { INITIAL_VALUES_TEMPLATES } from "./data/constants";
import { takePendingBlobFile } from "../../components/core/Editor/pendingBlobFileRegistry";

const TemplatesUpdateHandler = () => {
    const { id } = useParams();
    const isEditMode = !!id;
    const navigate = useNavigate();
    const { t } = useTranslation();
    // The template id is generated server-side on create; the UI never pre-generates it.
    const [templates, setTemplates] = useState(INITIAL_VALUES_TEMPLATES);
    // Files queued during creation; they are uploaded after the template exists.
    const [pendingFiles, setPendingFiles] = useState([]);
    const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
    const [isProcessingAttachments, setIsProcessingAttachments] = useState(false);

    const { getUrlS3File } = useAttachmentsS3();
    const { saveAttachmentsTemplate } = useTemplateAttachments();

    const { data, isLoading } = useQuery({
        queryKey: ["TemplatesForm", id],
        queryFn: async () => genericView(`${TEMPLATES_SERVICE}/${id}`),
        enabled: !!id,
    });

    const { mutateAsync, isPending } = useGeneralMutation({
        keyQuery: "templatesData",
    });

    const uploadPendingAttachments = async (templateId, values) => {
        const includeAttachments = values.incluye_adjuntos === true || values.incluye_adjuntos === "true";
        if (!includeAttachments || pendingFiles.length === 0) return;

        const files = pendingFiles.map((pendingFile) => pendingFile.fileData);
        const uploadedFiles = await getUrlS3File(templateId, files, "template");
        await saveAttachmentsTemplate(templateId, uploadedFiles);
    };

    /*
     * Images inserted into the body before the template existed are held as local
     * blob: object-URL previews (see Toolbar's handleImageFileSelected) since there
     * was no template id yet to upload against. Now that the template was created,
     * upload each one for real and rewrite it into the same template-attachment://
     * reference an edit-mode upload would have produced, so the persisted body is
     * created the same way in both flows. Returns the original html unchanged if
     * there was nothing pending.
     */
    const resolveInlinePendingImages = async (templateId, html) => {
        if (!html || !html.includes("blob:")) return html;

        const doc = new DOMParser().parseFromString(html, "text/html");
        const pendingImages = Array.from(doc.querySelectorAll("img")).filter((img) =>
            (img.getAttribute("src") || "").startsWith("blob:"),
        );
        if (pendingImages.length === 0) return html;

        for (const img of pendingImages) {
            const blobUrl = img.getAttribute("src");
            try {
                const pendingFile = takePendingBlobFile(blobUrl);
                if (!pendingFile) throw new Error("upload_error");
                const filename = img.getAttribute("data-filename") || pendingFile.name;
                const mime = img.getAttribute("data-mime") || pendingFile.type;
                const file = new File([pendingFile], filename, { type: mime });

                const [uploaded] = await getUrlS3File(templateId, [file], "template");
                await saveAttachmentsTemplate(templateId, [{ ...uploaded, usageType: "inline" }]);

                img.setAttribute("src", `template-attachment://${templateId}`);
                if (!img.getAttribute("data-filename")) img.setAttribute("data-filename", filename);
                if (!img.getAttribute("data-mime")) img.setAttribute("data-mime", mime);
            } finally {
                URL.revokeObjectURL(blobUrl);
            }
        }

        return doc.body.innerHTML;
    };

    const handleTemplates = async (values, setFormikErrors, setFormikStatus) => {
        if (isProcessingAttachments) return;

        const cleanedValues = removeKey(values, [
            "adjuntos",
            "campo",
            "campo_destino",
            "campo_copia",
            "campo_copia_oculta",
            "ruta",
        ]);
        const data = genericHandleSendInformation({
            values: cleanedValues,
            urlService: TEMPLATES_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            options: { isCreate: !isEditMode, serverGeneratedId: !isEditMode, keepEmptyStrings: true },
        });
        if (!data) return;

        const finalData = {
            ...data,
            url: isEditMode ? `${TEMPLATES_SERVICE}/${id}` : TEMPLATES_SERVICE,
        };

        let response;
        try {
            response = await mutateAsync(finalData);
        } catch {
            // Errors are surfaced by useGeneralMutation's onError toast.
            return;
        }

        if (isEditMode) {
            navigate("/templates", { replace: true });
            return;
        }

        // Adopt the server-generated template id from the create response.
        const templateId = response?.data?.data?.id;
        if (!templateId) {
            navigate("/templates", { replace: true });
            return;
        }

        try {
            setIsUploadingAttachments(true);
            await uploadPendingAttachments(templateId, values);

            const resolvedCuerpo = await resolveInlinePendingImages(templateId, values.cuerpo);
            if (resolvedCuerpo !== values.cuerpo) {
                await sendInformation({
                    url: `${TEMPLATES_SERVICE}/${templateId}`,
                    dataPost: { cuerpo: resolvedCuerpo },
                });
            }

            navigate("/templates", { replace: true });
        } catch {
            /*
             * The template was created; never roll it back. Send the user to edit
             * mode so the attachments/inline images can be retried against the
             * persisted template.
             */
            toast.error(t("app.alerts.upload_error"));
            navigate(`/templates/update/${templateId}`, { replace: true });
        } finally {
            setIsUploadingAttachments(false);
        }
    };

    useEffect(() => {
        if (data) {
            setTemplates(data);
        }
    }, [data]);

    return (
        <>
            {isLoading ? (
                <GeneralLoader />
            ) : (
                <TemplatesForm
                    dataHandler={handleTemplates}
                    data={templates}
                    isSending={isPending || isUploadingAttachments || isProcessingAttachments}
                    pendingFiles={pendingFiles}
                    onPendingFilesChange={setPendingFiles}
                    onPendingFilesProcessingChange={setIsProcessingAttachments}
                />
            )}
        </>
    );
};

export default TemplatesUpdateHandler;
