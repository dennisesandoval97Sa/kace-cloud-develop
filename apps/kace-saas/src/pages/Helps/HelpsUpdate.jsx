import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { GeneralLoader } from "../../components/ui-shared";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import useGenericViewQuery from "../../hooks/useGenericViewQuery";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";
import { fetchDelete } from "../../services/deleteService";
import { URL_AND_KEYS } from "../../utils/urlAndKeys";
import HelpsForm from "./components/HelpsForm";
import { initialValuesHelps } from "./data/Constants";
import useHelpAttachments from "./hooks/useHelpAttachments";
import { getTranslatedPublicErrorCode } from "@/utils/getTranslatedError";

const HelpsUpdate = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const isEditMode = !!id;
    const [formData, setFormData] = useState(initialValuesHelps);
    const [createdHelpId, setCreatedHelpId] = useState(null);
    const [pendingAttachments, setPendingAttachments] = useState([]);
    const [isProcessingAttachments, setIsProcessingAttachments] = useState(false);
    const { uploadPendingAttachments } = useHelpAttachments();

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.helps.key,
        onSuccessToast: false,
    });

    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.helps.url}/${id}`,
        keyQuery: URL_AND_KEYS.helps.key,
        searchById: [id],
        staleTime: 0,
        gcTime: 0,
        enabled: isEditMode,
    });

    const handleHelps = async (values, setFormikErrors, setFormikStatus) => {
        if (isPending || isProcessingAttachments) return;

        const payload = genericHandleSendInformation({
            values,
            fields: ["help_id"],
            urlService: URL_AND_KEYS.helps.url,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            options: {
                isCreate: !isEditMode,
                serverGeneratedId: !isEditMode,
            },
        });

        const finalPayload = {
            ...payload,
            url: isEditMode ? `${URL_AND_KEYS.helps.url}/${id}` : URL_AND_KEYS.helps.url,
        };

        try {
            if (isEditMode) {
                await mutate(finalPayload);
                toast.success(t("genericTexts.EverythingOk"));
                navigate(URL_AND_KEYS.helps.url, { replace: true });
                return;
            }

            let persistedHelpId = createdHelpId;
            if (!persistedHelpId) {
                const response = await mutate(finalPayload);
                persistedHelpId = response?.data?.data?.id ?? response?.data?.id;
                if (!persistedHelpId) throw new Error("missing_help_id");
                setCreatedHelpId(persistedHelpId);
            }

            if (pendingAttachments.length) {
                setIsProcessingAttachments(true);
                const attachmentOutcomes = await uploadPendingAttachments(persistedHelpId, pendingAttachments);
                setPendingAttachments(attachmentOutcomes);
                const failedAttachments = attachmentOutcomes.filter((attachment) => attachment.status === "failed");

                if (failedAttachments.length) {
                    const allAttachmentsFailed = failedAttachments.length === attachmentOutcomes.length;
                    if (allAttachmentsFailed) {
                        // El borrado es compensatorio: si falla, no debe enmascarar el error de adjuntos que se reporta abajo.
                        const deletedHelp = await fetchDelete(persistedHelpId, URL_AND_KEYS.helps.url).catch(
                            () => false,
                        );
                        if (deletedHelp) setCreatedHelpId(null);
                    }

                    const codedFailure = failedAttachments.find((attachment) => attachment.errorCode);
                    const message = codedFailure
                        ? getTranslatedPublicErrorCode(codedFailure.errorCode, t)
                        : t("app.alerts.upload_error");
                    toast.error(message || t("app.alerts.upload_error"));
                    return;
                }
            }

            toast.success(t("genericTexts.EverythingOk"));
            navigate(URL_AND_KEYS.helps.url, { replace: true });
        } catch (error) {
            if (error?.message === "missing_help_id") {
                toast.error(t("app.alerts.upload_error"));
            }
        } finally {
            setIsProcessingAttachments(false);
        }
    };

    useEffect(() => {
        if (data) {
            const filteredData = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "attachments"));
            filteredData.help_id = filteredData.id || filteredData.help_id;
            setFormData((state) => ({ ...state, ...filteredData }));
        }
    }, [data]);

    return (
        <DashboardSectionCard title="app.title.helps">
            {isLoading ? (
                <GeneralLoader />
            ) : (
                <HelpsForm
                    data={formData}
                    dataHandler={handleHelps}
                    isSending={isPending || isProcessingAttachments}
                    isEditMode={isEditMode}
                    persistedHelpId={createdHelpId}
                    pendingAttachments={pendingAttachments}
                    onPendingAttachmentsChange={setPendingAttachments}
                />
            )}
        </DashboardSectionCard>
    );
};

export default HelpsUpdate;
