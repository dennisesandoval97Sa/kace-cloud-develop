import PropTypes from "prop-types";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Clock, Mail, Tag, User, BookOpen, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getBadgeColor, getInteractionStatus } from "./utils/stateAndColor";
import InteractionWorkspaceMove from "./workSpace/InteractionWorkspaceMove";
import LinkedInteractionCasesList from "./cases/LinkedInteractionCasesList";
import { downloadEmailZip } from "./utils/downloadEmailZip";
import { createCaseAction } from "./utils/openCaseAction";
import { Button } from "@/components/ui-shared";
import useInteractionReviewActions from "@/pages/Interactions/hooks/useInteractionReviewActions";
import { useAgentContext } from "../../context/AgentContext";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import useUserInformation from "@/hooks/useUserInformation";

const InfoRow = ({ icon: Icon, label, value }) => (
    <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 w-4 h-4 shrink-0 text-gray-400" />
        <span className="shrink-0 font-medium">{label}:</span>
        <span className="min-w-0 break-words text-gray-700">{value}</span>
    </div>
);

InfoRow.propTypes = {
    icon: PropTypes.elementType.isRequired,
    label: PropTypes.node.isRequired,
    value: PropTypes.node.isRequired,
};

const getReviewerId = (interaction) =>
    interaction?.start_review_by ?? interaction?.reviewer_id ?? interaction?.reviewer?.id ?? null;

const hasPermission = (permissions = [], moduleId, permissionName) =>
    permissions.some(
        (permission) =>
            permission?.module_id === moduleId && permission?.name === permissionName && permission?.granted === true,
    );

const noop = () => {};

const InteractionDetail = ({
    interaction,
    onViewEmail,
    senderEmail,
    isUpdating,
    onClose,
    onReviewChange,
    email,
    setOpenManagerClient,
    canOpenAssociateCase = false,
    onAssociateCase,
    canViewLinkedCases = false,
    linkedCases = [],
    onViewLinkedCase,
    canCloseInteraction = false,
    canMoveWorkspace = false,
    onMissingClientSelection,
    isInteractionCaseActionDisabled = false,
    activeGroupId,
    onInteractionMoved,
}) => {
    const { t } = useTranslation();
    const { user, permissionsAgent } = useUserInformation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { clientId: selectedClientId, isNewClient } = useAgentContext();
    const { cases: configCases } = useConfigAgentData();

    const [showMoveWorkspace, setShowMoveWorkspace] = useState(false);
    const [isDownloadingEmail, setIsDownloadingEmail] = useState(false);
    const { button: reviewButton, isPending: isReviewPending } = useInteractionReviewActions({
        interaction,
        onSuccess: onReviewChange,
        agentScoped: true,
        activeGroupId,
    });

    const reviewedAtValue = interaction?.start_review_at || interaction?.fechaRevision;
    const reviewedAtDate = reviewedAtValue ? new Date(reviewedAtValue) : null;
    const hasReviewStart = Boolean(reviewedAtDate) && !Number.isNaN(reviewedAtDate.getTime());

    const handleDownloadEmail = async () => {
        if (!interaction?.email_id || isDownloadingEmail) return;

        setIsDownloadingEmail(true);
        try {
            await downloadEmailZip(interaction.email_id);
        } catch {
            toast.error(t("interactions.detail.downloadEmailError"));
        } finally {
            setIsDownloadingEmail(false);
        }
    };

    const hasSelectedClient = Boolean(selectedClientId && !isNewClient);
    const handleCreateCase = () => {
        if (isInteractionCaseActionDisabled) return;

        if (!hasSelectedClient) {
            if (onMissingClientSelection) {
                onMissingClientSelection();
                return;
            }

            // Creating a case without a selected client should always open the manager.
            setOpenManagerClient(true);
            return;
        }

        createCaseAction({
            dispatch,
            navigate,
            clientId: selectedClientId,
            canCreateSubcases: Boolean(configCases?.case_enable_subcases),
            interactionId: interaction.id,
        });
    };

    const isClosed = interaction?.is_closed;
    const notAvailableLabel = t("interactions.detail.notAvailable");
    const canReleaseClosedReview = Boolean(isClosed && interaction?.in_review && reviewButton.onClick);
    const isReviewActionDisabled =
        reviewButton.disabled || isReviewPending || isUpdating || (isClosed && !canReleaseClosedReview);
    const isReleaseReviewAction = reviewButton.intent === "release";
    const reviewerId = getReviewerId(interaction);
    const handleViewLinkedCase = onViewLinkedCase ?? noop;
    const isCurrentReviewer = Boolean(user?.id && reviewerId && String(user.id) === String(reviewerId));
    const interactionCaseActionDisabledTitle = isInteractionCaseActionDisabled
        ? t("interactions.client.validatingSelectedClient", {
              defaultValue: "Validating the Interaction sender Client",
          })
        : undefined;
    const canOpenCreateCase = Boolean(
        interaction?.id &&
        interaction?.in_review &&
        isCurrentReviewer &&
        !isClosed &&
        hasPermission(permissionsAgent, "cases", "CasesCreate"),
    );
    const reviewButtonClassName = [
        "transition-all duration-200 disabled:shadow-none disabled:ring-0",
        isReleaseReviewAction
            ? "border border-[#F5B13A] bg-[#FFF7E6] text-[#B86B00] hover:border-[#E39A16] hover:bg-[#FFE9B8] hover:text-[#8A4B00] hover:shadow-[0_6px_16px_rgba(245,177,58,0.24)] hover:ring-2 hover:ring-[#F5B13A]/25"
            : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_6px_16px_rgba(15,23,42,0.16)] hover:ring-2 hover:ring-primary/20",
    ]
        .filter(Boolean)
        .join(" ");

    if (!interaction) {
        return (
            <div className="border rounded-lg bg-white h-[calc(100vh-330px)] flex items-center justify-center">
                <div className="text-center text-gray-400">
                    <Mail className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-lg">{t("interactions.detail.selectInteraction")}</p>
                    {email?.sender ?? notAvailableLabel}
                </div>
            </div>
        );
    }
    return (
        <div className="h-[calc(100vh-330px)] flex flex-col rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex flex-col gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold leading-snug text-gray-900 mb-1 break-words">
                            {`RE: ${interaction?.description}`}
                        </h3>
                        <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeColor(interaction)}`}
                        >
                            {getInteractionStatus(interaction, t)}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <InteractionWorkspaceMove
                            interaction={interaction}
                            showMoveWorkspace={showMoveWorkspace}
                            setShowMoveWorkspace={setShowMoveWorkspace}
                            canMoveWorkspace={canMoveWorkspace}
                            activeGroupId={activeGroupId}
                            onInteractionMoved={onInteractionMoved}
                        />

                        {canOpenCreateCase && (
                            <Button
                                id="btn_interaction_create_case"
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCreateCase}
                                disabled={isInteractionCaseActionDisabled}
                                title={interactionCaseActionDisabledTitle}
                                className="text-green-700 hover:text-green-900 underline underline-offset-4 whitespace-nowrap"
                            >
                                {t("button.newCase")}
                            </Button>
                        )}

                        {canOpenAssociateCase && (
                            <Button
                                id="btn_interaction_associate_case"
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onAssociateCase}
                                disabled={isInteractionCaseActionDisabled}
                                title={interactionCaseActionDisabledTitle}
                                className="text-blue-700 hover:text-blue-900 underline underline-offset-4 whitespace-nowrap"
                            >
                                {t("interactions.cases.associateCase", { defaultValue: "Associate Case" })}
                            </Button>
                        )}

                        <div className="ml-auto flex items-center justify-end gap-2">
                            <Button
                                onClick={reviewButton.onClick}
                                disabled={isReviewActionDisabled}
                                title={reviewButton.title}
                                className={`${reviewButtonClassName} whitespace-nowrap`}
                            >
                                {reviewButton.label}
                            </Button>

                            {canCloseInteraction && (
                                <Button
                                    onClick={onClose}
                                    disabled={isUpdating || isClosed}
                                    className="bg-red-500 hover:bg-red-400 text-white whitespace-nowrap"
                                >
                                    {t("interactions.detail.close")}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <InfoRow
                        icon={Calendar}
                        label={t("interactions.detail.received")}
                        value={format(interaction.created_at, "dd/MM/yyyy HH:mm", { locale: es })}
                    />
                    <InfoRow
                        icon={Clock}
                        label={t("interactions.detail.reviewed")}
                        value={
                            hasReviewStart
                                ? format(reviewedAtDate, "dd/MM/yyyy HH:mm", { locale: es })
                                : t("interactions.detail.notReviewed")
                        }
                    />
                    <InfoRow
                        icon={User}
                        label={t("interactions.detail.from")}
                        value={senderEmail || notAvailableLabel}
                    />
                    <InfoRow
                        icon={Tag}
                        label={t("interactions.detail.priority")}
                        value={interaction.priority || t("interactions.detail.normal")}
                    />
                </div>

                <hr className="border-gray-200" />

                <div className="flex justify-center gap-4">
                    <Button
                        id="btn_interaction_view_email"
                        variant="outline"
                        onClick={() => onViewEmail?.(interaction?.email_id)}
                        title={t("interactions.detail.viewEmail")}
                        aria-label={t("interactions.detail.viewEmail")}
                        className="p-2 rounded-lg"
                    >
                        <BookOpen className="w-5 h-5" />
                    </Button>

                    <Button
                        id="btn_interaction_download_email"
                        variant="outline"
                        onClick={handleDownloadEmail}
                        disabled={!interaction?.email_id || isDownloadingEmail}
                        title={t("interactions.detail.downloadEmail")}
                        aria-label={t("interactions.detail.downloadEmail")}
                        className="p-2 rounded-lg"
                    >
                        <Download className="w-5 h-5" />
                    </Button>
                </div>

                {canViewLinkedCases && (
                    <LinkedInteractionCasesList cases={linkedCases} onViewCase={handleViewLinkedCase} />
                )}
            </div>
        </div>
    );
};

InteractionDetail.propTypes = {
    interaction: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        email_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

        description: PropTypes.string,
        priority: PropTypes.string,

        workspace_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

        created_at: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]).isRequired,

        start_review_at: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
        fechaRevision: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),

        in_review: PropTypes.bool,
        is_closed: PropTypes.bool,
        attachment: PropTypes.arrayOf(
            PropTypes.shape({
                nombre: PropTypes.string,
                tamano: PropTypes.string,
            }),
        ),
    }),

    senderEmail: PropTypes.string,

    isUpdating: PropTypes.bool,

    onClose: PropTypes.func,
    onReviewChange: PropTypes.func,
    onViewEmail: PropTypes.func,
    email: PropTypes.object,
    setOpenManagerClient: PropTypes.func.isRequired,
    canOpenAssociateCase: PropTypes.bool,
    onAssociateCase: PropTypes.func,
    canViewLinkedCases: PropTypes.bool,
    linkedCases: PropTypes.array,
    onViewLinkedCase: PropTypes.func,
    canCloseInteraction: PropTypes.bool,
    canMoveWorkspace: PropTypes.bool,
    onMissingClientSelection: PropTypes.func,
    isInteractionCaseActionDisabled: PropTypes.bool,
    activeGroupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onInteractionMoved: PropTypes.func,
};

export default InteractionDetail;
