import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui-shared";
import { useInteractionAttachmentDownload } from "../hooks/useInteractionAttachmentDownload";
import { useInteractionReviewActions } from "../hooks/useInteractionReviewActions";
import { useInteractionEmail } from "../hooks/useInteractionEmail";
import { downloadAttachmentsZip } from "../../Agent/components/Interactions/utils/downloadAttachmentsZip";
import { downloadEmailZip } from "../../Agent/components/Interactions/utils/downloadEmailZip";
import { InteractionMotiveDialog, InteractionMoveDialog } from "./InteractionDetailActionDialogs";
import InteractionDetailModalContent, { InteractionFullEmailDialog } from "./InteractionDetailModalContent";

const getAttachments = (item) => {
    const attachments = Array.isArray(item) ? item : (item?.attachments ?? item?.attachment ?? []);
    return Array.isArray(attachments) ? attachments : [];
};

const hasBodyContent = (body) => {
    if (typeof body === "string") {
        return body.trim().length > 0;
    }

    if (!body || typeof body !== "object") {
        return false;
    }

    return Boolean(
        String(body.body ?? "").trim() ||
        String(body.body_html ?? "").trim() ||
        body.text?.bodyUrl ||
        body.text?.body_url ||
        body.html?.bodyUrl ||
        body.html?.body_url,
    );
};

const mergeInteractionWithEmail = (interaction, email) => {
    if (!interaction || !email) {
        return interaction;
    }

    const interactionAttachments = getAttachments(interaction);
    const emailAttachments = getAttachments(email);

    return {
        ...interaction,
        subject: interaction.subject || email.subject,
        sender: interaction.sender || email.sender,
        to: interaction.to ?? email.to,
        description: interaction.description || email.subject,
        client_identifier: interaction.client_identifier || email.sender,
        external_identifier: interaction.external_identifier || email.sender,
        priority: interaction.priority || email.priority,
        receipt_at: interaction.receipt_at || email.received_at,
        created_at: interaction.created_at || email.created_at,
        body: hasBodyContent(interaction.body) ? interaction.body : email.body,
        attachments: interactionAttachments.length > 0 ? interactionAttachments : emailAttachments,
    };
};

const getAttachmentsZipName = (interaction) => {
    if (interaction?.id) {
        return `${interaction.id}-attachments.zip`;
    }

    return "attachments.zip";
};

const InteractionDetailModal = ({
    open,
    onOpenChange,
    interaction,
    workspaceOptions = [],
    motiveOptions = [],
    isLoadingWorkspaces = false,
    isLoadingMotiveOptions = false,
    isMovingInteraction = false,
    isClosingInteraction = false,
    isDeletingInteraction = false,
    onMoveInteraction,
    onCloseInteraction,
    onDeleteInteraction,
    onReviewChange,
}) => {
    const { t } = useTranslation();
    const { openAttachment } = useInteractionAttachmentDownload();
    const [activeActionDialog, setActiveActionDialog] = useState(null);
    const [isFullContentOpen, setIsFullContentOpen] = useState(false);
    const [isDownloadingEmail, setIsDownloadingEmail] = useState(false);
    const shouldLoadEmail =
        open &&
        interaction?.email_id &&
        (!hasBodyContent(interaction.body) || getAttachments(interaction).length === 0);
    const { email } = useInteractionEmail(shouldLoadEmail ? interaction.email_id : null);
    const modalInteraction = useMemo(() => mergeInteractionWithEmail(interaction, email), [email, interaction]);
    const { button: reviewButton } = useInteractionReviewActions({
        interaction: modalInteraction,
        onSuccess: onReviewChange,
    });

    useEffect(() => {
        setIsFullContentOpen(false);
    }, [open, interaction?.id]);

    const handleDownloadAttachments = useCallback(
        async (attachments) => {
            if (modalInteraction?.email_id) {
                if (isDownloadingEmail) return;

                setIsDownloadingEmail(true);
                try {
                    await downloadEmailZip(modalInteraction.email_id);
                } catch {
                    toast.error(t("interactions.detail.downloadEmailError"));
                } finally {
                    setIsDownloadingEmail(false);
                }
                return;
            }

            const downloadableAttachments = getAttachments(attachments).filter((attachment) => attachment?.url);

            if (downloadableAttachments.length === 0) {
                return;
            }

            try {
                await downloadAttachmentsZip(downloadableAttachments, getAttachmentsZipName(modalInteraction));
            } catch {
                toast.error(t("app.alerts.download_error"));
            }
        },
        [isDownloadingEmail, modalInteraction, t],
    );
    const closeAllDialogs = useCallback(() => {
        setActiveActionDialog(null);
        setIsFullContentOpen(false);
        onOpenChange(false);
    }, [onOpenChange]);

    const handleOpenChange = useCallback(
        (nextOpen) => {
            if (!nextOpen) {
                setActiveActionDialog(null);
                setIsFullContentOpen(false);
            }
            onOpenChange(nextOpen);
        },
        [onOpenChange],
    );

    const handleMoveInteraction = useCallback(
        async ({ workspace_id }) => {
            await onMoveInteraction?.(modalInteraction, { workspace_id });
            closeAllDialogs();
        },
        [closeAllDialogs, modalInteraction, onMoveInteraction],
    );

    const handleCloseInteraction = useCallback(
        async ({ motive }) => {
            await onCloseInteraction?.(modalInteraction, { motive });
            closeAllDialogs();
        },
        [closeAllDialogs, modalInteraction, onCloseInteraction],
    );

    const handleDeleteInteraction = useCallback(
        async ({ motive }) => {
            await onDeleteInteraction?.(modalInteraction, { motive });
            closeAllDialogs();
        },
        [closeAllDialogs, modalInteraction, onDeleteInteraction],
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="w-[calc(100vw-2rem)] max-w-[760px] overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-[760px]"
            >
                <InteractionDetailModalContent
                    interaction={modalInteraction}
                    workspaceOptions={workspaceOptions}
                    onOpenAttachment={openAttachment}
                    onDownloadAttachments={handleDownloadAttachments}
                    onActionSelect={setActiveActionDialog}
                    onOpenChange={handleOpenChange}
                    onOpenContent={() => setIsFullContentOpen(true)}
                    reviewButton={reviewButton}
                    t={t}
                />
            </DialogContent>
            <InteractionFullEmailDialog
                open={open && isFullContentOpen}
                onOpenChange={setIsFullContentOpen}
                interaction={modalInteraction}
                onOpenAttachment={openAttachment}
                t={t}
            />
            <InteractionMoveDialog
                open={activeActionDialog === "move"}
                onOpenChange={(nextOpen) => setActiveActionDialog(nextOpen ? "move" : null)}
                interaction={modalInteraction}
                workspaceOptions={workspaceOptions}
                isLoadingOptions={isLoadingWorkspaces}
                isPending={isMovingInteraction}
                onSubmit={handleMoveInteraction}
                t={t}
            />
            <InteractionMotiveDialog
                open={activeActionDialog === "close"}
                onOpenChange={(nextOpen) => setActiveActionDialog(nextOpen ? "close" : null)}
                interaction={modalInteraction}
                motiveOptions={motiveOptions}
                isLoadingOptions={isLoadingMotiveOptions}
                isPending={isClosingInteraction}
                onSubmit={handleCloseInteraction}
                mode="close"
                t={t}
            />
            <InteractionMotiveDialog
                open={activeActionDialog === "delete"}
                onOpenChange={(nextOpen) => setActiveActionDialog(nextOpen ? "delete" : null)}
                interaction={modalInteraction}
                motiveOptions={motiveOptions}
                isLoadingOptions={isLoadingMotiveOptions}
                isPending={isDeletingInteraction}
                onSubmit={handleDeleteInteraction}
                mode="delete"
                t={t}
            />
        </Dialog>
    );
};

InteractionDetailModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    interaction: PropTypes.object,
    workspaceOptions: PropTypes.array,
    motiveOptions: PropTypes.array,
    isLoadingWorkspaces: PropTypes.bool,
    isLoadingMotiveOptions: PropTypes.bool,
    isMovingInteraction: PropTypes.bool,
    isClosingInteraction: PropTypes.bool,
    isDeletingInteraction: PropTypes.bool,
    onMoveInteraction: PropTypes.func,
    onCloseInteraction: PropTypes.func,
    onDeleteInteraction: PropTypes.func,
    onReviewChange: PropTypes.func,
};

export default InteractionDetailModal;
