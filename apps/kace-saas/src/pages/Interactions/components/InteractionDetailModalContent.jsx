import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import DOMPurify from "dompurify";
import { Close, Content, Dialog as RadixDialog, Overlay, Portal, Title } from "@radix-ui/react-dialog";
import { apiService } from "@kace/utils";
import {
    ArrowLeft,
    BadgeCheck,
    BookOpen,
    Calendar,
    CalendarClock,
    ChevronDown,
    CircleX,
    Download,
    Ellipsis,
    File,
    FileText,
    Inbox,
    Mail,
    MailWarning,
    Move,
    Paperclip,
    Printer,
    Trash2,
    User,
} from "lucide-react";
import {
    DialogTitle,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui-shared";
import { getEmailBodyContent } from "../../Agent/components/Interactions/emails/emailBodyContent";
import { getAttachmentName, getInteractionAttachments, getInteractionSubject } from "../utils/interactionDisplayUtils";

const EMPTY_EXTERNAL_BODY_STATE = {
    status: "idle",
    content: "",
    contentType: null,
    part: null,
    error: null,
};

const getHeaderContentType = (headers) => headers?.["content-type"] ?? headers?.["Content-Type"] ?? null;

const normalizeExternalBodyResponse = (response) => {
    const responseContentType = getHeaderContentType(response?.headers);
    const responseData = response?.data;

    if (typeof responseData === "string") {
        return {
            content: responseData,
            contentType: responseContentType,
            part: null,
        };
    }

    const payload = responseData?.data ?? responseData ?? {};

    if (typeof payload === "string") {
        return {
            content: payload,
            contentType: responseContentType,
            part: null,
        };
    }

    return {
        content: payload.content ?? payload.body ?? "",
        contentType: payload.content_type ?? payload.contentType ?? responseContentType,
        part: payload.part ?? null,
    };
};

const shouldRenderExternalContentAsHtml = ({ preferredPart, contentType, part }) => {
    if (part === "html") {
        return true;
    }

    if (part === "text") {
        return false;
    }

    if (contentType && /html/i.test(contentType)) {
        return true;
    }

    return preferredPart === "html";
};

const getInteractionSender = (interaction) =>
    interaction?.sender || interaction?.client_identifier || interaction?.external_identifier || "—";

const getInteractionRecipient = (interaction) => {
    if (Array.isArray(interaction?.to)) {
        return (
            interaction.to
                .map((recipient) => firstText(recipient?.email, recipient?.address, recipient?.name, recipient))
                .filter(Boolean)
                .join(", ") || "soporte@kace.com"
        );
    }

    if (interaction?.to && typeof interaction.to === "object") {
        return firstText(interaction.to.email, interaction.to.address, interaction.to.name) || "soporte@kace.com";
    }

    return (
        firstText(
            interaction?.to,
            interaction?.recipient,
            interaction?.recipient_email,
            interaction?.to_email,
            interaction?.mail_to,
            interaction?.mailbox_address,
        ) || "soporte@kace.com"
    );
};

const getEmailSubject = (subject) => {
    const normalizedSubject = subject || "Sin asunto";
    return /^re:/i.test(normalizedSubject) ? normalizedSubject : `Re: ${normalizedSubject}`;
};

/**
 * Formats a timestamp in the user's local timezone.
 *
 * Expects the backend to send UTC ISO-8601 (with a "Z" suffix or explicit
 * offset). `new Date()` parses that as a UTC instant and `format` renders it in
 * the browser's local timezone. A naive string without offset (e.g.
 * "2024-04-29T18:36:11.000") would be interpreted as local time and shown
 * unconverted, so the backend must always include the timezone.
 *
 * @param {string|Date} value ISO-8601 string with timezone (preferably "...Z") or a Date.
 * @returns {string} The date formatted as "yyyy-MM-dd HH:mm:ss" in local time, or "—".
 */
const formatModalDate = (value) => {
    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return format(date, "yyyy-MM-dd HH:mm:ss");
};

const stripHtml = (value = "") =>
    String(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const getBodyPreview = (interaction) => {
    const emailBodyContent = getEmailBodyContent({ body: interaction?.body });
    const preview = emailBodyContent.plain || stripHtml(emailBodyContent.html);

    return preview.trim();
};

const getRenderedBodyContent = (interaction, externalBodyState = EMPTY_EXTERNAL_BODY_STATE) => {
    const emailBodyContent = getEmailBodyContent({ body: interaction?.body });
    const hasLoadedExternalBody = emailBodyContent.isExternal && externalBodyState.status === "loaded";

    if (hasLoadedExternalBody) {
        const externalBodyIsHtml = shouldRenderExternalContentAsHtml({
            preferredPart: emailBodyContent.preferredPart,
            contentType: externalBodyState.contentType ?? emailBodyContent.contentType,
            part: externalBodyState.part,
        });

        return {
            plain: externalBodyIsHtml ? "" : externalBodyState.content,
            html: externalBodyIsHtml ? externalBodyState.content : "",
        };
    }

    return {
        plain: emailBodyContent.plain ?? "",
        html: emailBodyContent.isExternal ? "" : (emailBodyContent.html ?? ""),
    };
};

const toText = (value) => {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return "";
};

const firstText = (...values) => values.map(toText).find(Boolean) || "";

const getWorkspaceObjectLabel = (workspace) =>
    firstText(workspace?.description, workspace?.name, workspace?.descripcion, workspace?.nombre, workspace?.label);

const getWorkspaceFlatLabel = (interaction) =>
    firstText(
        interaction?.workspace_description,
        interaction?.workspace_name,
        interaction?.workspace_label,
        interaction?.workspace_descripcion,
        interaction?.workspace_nombre,
    );

const getWorkspaceOptionLabel = (workspaceId, workspaceOptions) => {
    const workspaceIdText = toText(workspaceId);
    if (!workspaceIdText) return "";

    const workspaceOption = workspaceOptions.find((option) => {
        const optionValue = firstText(option?.value, option?.id);
        return optionValue === workspaceIdText;
    });

    return firstText(workspaceOption?.label, workspaceOption?.description, workspaceOption?.name);
};

const getLegacyChannel = (interaction) =>
    firstText(interaction?.channel, interaction?.channel_name, interaction?.source, interaction?.mailbox);

const hasWorkspaceIdentity = (interaction) =>
    Boolean(interaction?.workspace || interaction?.workspace_id || getWorkspaceFlatLabel(interaction));

const getWorkspaceLabel = (interaction, workspaceOptions = []) => {
    const workspaceLabel =
        getWorkspaceObjectLabel(interaction?.workspace) ||
        getWorkspaceFlatLabel(interaction) ||
        getWorkspaceOptionLabel(interaction?.workspace_id, workspaceOptions);

    if (workspaceLabel) return workspaceLabel;
    if (hasWorkspaceIdentity(interaction)) return "—";

    return getLegacyChannel(interaction) || "—";
};

const getPriority = (interaction, t) =>
    interaction?.priority ||
    interaction?.priority_label ||
    interaction?.status_label ||
    t("interactions.detail.normal", "Normal");

const SummaryCard = ({ icon: Icon, iconClassName, label, value }) => (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
            <Icon className={`h-[13px] w-[13px] shrink-0 ${iconClassName}`} />
            <span className="truncate text-[11px] font-bold text-gray-500">{label}</span>
        </div>
        <span className="truncate text-xs font-bold leading-tight text-gray-900">{value}</span>
    </div>
);

const InteractionDetailModalContent = ({
    interaction,
    workspaceOptions = [],
    onActionSelect,
    onDownloadAttachments,
    onOpenAttachment,
    onOpenChange,
    onOpenContent,
    reviewButton,
    t,
}) => {
    const subject = getInteractionSubject(interaction) || t("interactions.detail.noSubject", "Sin asunto");
    const sender = getInteractionSender(interaction);
    const attachments = getInteractionAttachments(interaction);
    const canDownloadEmail = Boolean(interaction?.email_id);
    const bodyPreview = getBodyPreview(interaction) || t("genericTexts.noContent", "Sin contenido");
    const reviewButtonLabel = reviewButton?.label ?? t("interactions.detail.modal.manage", "Gestionar");
    const isReviewButtonDisabled = Boolean(reviewButton?.disabled);
    const isReleaseReviewButton = reviewButton?.intent === "release";
    const reviewButtonClassName = [
        "h-8 rounded-md px-4 text-[13px] font-bold transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:ring-0",
        isReleaseReviewButton
            ? "border border-[#F5B13A] bg-[#FFF7E6] text-[#B86B00] hover:border-[#E39A16] hover:bg-[#FFE9B8] hover:text-[#8A4B00] hover:shadow-[0_6px_16px_rgba(245,177,58,0.24)] hover:ring-2 hover:ring-[#F5B13A]/25 focus:ring-2 focus:ring-[#F5B13A]/30"
            : "border border-[#BDEBED] bg-[#E8FAFA] text-[#2BAEB5] hover:border-[#8FDDE1] hover:bg-[#DDF7F8] hover:shadow-[0_6px_16px_rgba(43,174,181,0.18)] hover:ring-2 hover:ring-[#2BAEB5]/20 focus:ring-2 focus:ring-[#2BAEB5]/30",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className="flex h-[500px] max-h-[85vh] flex-col gap-4 overflow-hidden rounded-lg border border-gray-200 bg-white px-7 py-6 shadow-[0_10px_24px_rgba(15,23,42,0.09)]">
            <div className="flex min-h-[43px] items-center gap-3.5">
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label={t("interactions.detail.modal.back", "Atrás")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-slate-50 text-gray-700"
                >
                    <ArrowLeft className="h-[18px] w-[18px]" />
                </button>
                <div className="min-w-0 flex-1">
                    <DialogTitle asChild>
                        <h2 className="truncate text-xl font-extrabold leading-tight text-[#263238]">{subject}</h2>
                    </DialogTitle>
                    <p className="truncate text-xs font-medium leading-tight text-gray-600">{sender}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5 pr-8">
                    <button
                        type="button"
                        onClick={reviewButton?.onClick}
                        disabled={isReviewButtonDisabled}
                        title={reviewButton?.title}
                        className={reviewButtonClassName}
                    >
                        {reviewButtonLabel}
                    </button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label={t("interactions.detail.actions.moreOptions", "Más opciones")}
                                className="flex h-8 w-[38px] items-center justify-center rounded-md border border-[#8E24AA] bg-white text-[#8E24AA] data-[state=open]:bg-[#F8F0FF]"
                            >
                                <Ellipsis className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="z-[70] w-[222px] rounded-[10px] border border-gray-200 bg-white p-1.5 shadow-lg"
                        >
                            <DropdownMenuItem
                                className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 text-[13px] font-bold text-[#263238] focus:bg-slate-50 focus:text-[#263238]"
                                onSelect={() => onActionSelect?.("move")}
                            >
                                <Move className="h-4 w-4" />
                                {t("interactions.detail.actions.move", "Mover interaccion")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 text-[13px] font-bold text-[#263238] focus:bg-slate-50 focus:text-[#263238]"
                                onSelect={() => onActionSelect?.("close")}
                            >
                                <CircleX className="h-4 w-4" />
                                {t("interactions.detail.actions.close", "Cerrar interaccion")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[7px] bg-red-50 px-2.5 text-[13px] font-bold text-red-600 focus:bg-red-50 focus:text-red-600"
                                onSelect={() => onActionSelect?.("delete")}
                            >
                                <Trash2 className="h-4 w-4" />
                                {t("interactions.detail.actions.delete", "Eliminar interaccion")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="grid h-[62px] grid-cols-4 gap-3">
                <SummaryCard
                    icon={Inbox}
                    iconClassName="text-gray-900"
                    label={t("interactions.detail.modal.channel", "Canal")}
                    value={getWorkspaceLabel(interaction, workspaceOptions)}
                />
                <SummaryCard
                    icon={BadgeCheck}
                    iconClassName="text-emerald-500"
                    label={t("interactions.detail.modal.priority", "Prioridad")}
                    value={getPriority(interaction, t)}
                />
                <SummaryCard
                    icon={CalendarClock}
                    iconClassName="text-violet-600"
                    label={t("interactions.detail.modal.received", "Recepción")}
                    value={formatModalDate(interaction?.receipt_at || interaction?.fecha)}
                />
                <SummaryCard
                    icon={Calendar}
                    iconClassName="text-sky-600"
                    label={t("interactions.detail.modal.created", "Creación")}
                    value={formatModalDate(interaction?.created_at)}
                />
            </div>

            <section className="flex h-[140px] flex-col gap-2.5 rounded-lg border border-gray-200 bg-white px-4 py-3.5">
                <div className="flex items-center gap-2">
                    <MailWarning className="h-4 w-4 text-[#B750D6]" />
                    <h3 className="text-[13px] font-extrabold text-[#263238]">
                        {t("interactions.detail.modal.contentPreview", "Vista previa del contenido")}
                    </h3>
                </div>
                <p className="line-clamp-3 text-xs font-medium leading-[1.45] text-gray-600">{bodyPreview}</p>
            </section>

            <section className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-lg border border-[#D9F1F3] bg-[#F8FEFF] px-3 py-2">
                <div className="flex h-[34px] items-center gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Paperclip className="h-[15px] w-[15px] text-[#37B8BE]" />
                        <h3 className="truncate text-[13px] font-extrabold text-[#263238]">
                            {t("interactions.detail.modal.attachmentsCount", {
                                count: attachments.length,
                                defaultValue: "Archivos adjuntos ({{count}})",
                            })}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenContent}
                        className="inline-flex h-[34px] items-center justify-center gap-1.5 rounded-md bg-[#2500B8] px-3 text-xs font-bold text-white"
                    >
                        <BookOpen aria-hidden="true" className="h-[14px] w-[14px]" />
                        {t("interactions.detail.modal.open", "Abrir")}
                    </button>
                    <button
                        type="button"
                        onClick={() => onDownloadAttachments?.(attachments)}
                        disabled={!canDownloadEmail && attachments.length === 0}
                        aria-label={t("interactions.detail.modal.downloadAttachments", "Descargar adjuntos")}
                        className="flex h-[34px] w-10 items-center justify-center rounded-md bg-gray-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Download className="h-[15px] w-[15px]" />
                    </button>
                </div>
                <div className="flex min-h-0 flex-col gap-1.5 overflow-auto">
                    {attachments.map((attachment, index) => {
                        const attachmentName = getAttachmentName(attachment);
                        const AttachmentIcon = /\.pdf$/i.test(attachmentName) ? FileText : File;

                        return (
                            <button
                                key={attachment.id ?? `${attachmentName}-${index}`}
                                type="button"
                                onClick={() => attachment.url && onOpenAttachment?.(attachment)}
                                className="flex h-[34px] shrink-0 items-center gap-2.5 rounded-md border border-[#D9F1F3] bg-white px-2 text-left"
                            >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#BDEBED] bg-[#E6FAFB] text-[#37B8BE]">
                                    <AttachmentIcon className="h-[17px] w-[17px]" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-extrabold leading-tight text-[#37B8BE]">
                                        {attachmentName}
                                    </span>
                                    <span className="block truncate text-[11px] font-medium leading-tight text-gray-500">
                                        {t("interactions.detail.modal.attachment", "Archivo adjunto")}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

export const InteractionFullEmailDialog = ({ open, onOpenChange, interaction, onOpenAttachment, t }) => {
    const subject = getInteractionSubject(interaction) || t("interactions.detail.noSubject", "Sin asunto");
    const emailSubject = getEmailSubject(subject);
    const sender = getInteractionSender(interaction);
    const recipient = getInteractionRecipient(interaction);
    const attachments = getInteractionAttachments(interaction);
    const bodyPreview = getBodyPreview(interaction) || t("genericTexts.noContent", "Sin contenido");
    const emailBodyContent = useMemo(() => getEmailBodyContent({ body: interaction?.body }), [interaction?.body]);
    const [externalBodyState, setExternalBodyState] = useState(EMPTY_EXTERNAL_BODY_STATE);
    const renderedBodyContent = getRenderedBodyContent(interaction, externalBodyState);
    const sanitizedHtmlBody = renderedBodyContent.html ? DOMPurify.sanitize(renderedBodyContent.html) : "";
    const fullBodyText = renderedBodyContent.plain || bodyPreview;
    const externalBodyUrl = emailBodyContent.isExternal ? emailBodyContent.bodyUrl : null;
    const isExternalBodyLoading = externalBodyState.status === "loading";
    const externalBodyLoadFailed = externalBodyState.status === "error";

    useEffect(() => {
        setExternalBodyState(EMPTY_EXTERNAL_BODY_STATE);

        if (!open || !externalBodyUrl) {
            return undefined;
        }

        let isCurrent = true;

        setExternalBodyState({
            ...EMPTY_EXTERNAL_BODY_STATE,
            status: "loading",
        });

        apiService
            .get(externalBodyUrl)
            .then((response) => {
                if (!isCurrent) {
                    return;
                }

                const bodyResponse = normalizeExternalBodyResponse(response);

                setExternalBodyState({
                    status: "loaded",
                    content: bodyResponse.content,
                    contentType: bodyResponse.contentType,
                    part: bodyResponse.part,
                    error: null,
                });
            })
            .catch((error) => {
                if (!isCurrent) {
                    return;
                }

                setExternalBodyState({
                    ...EMPTY_EXTERNAL_BODY_STATE,
                    status: "error",
                    error,
                });
            });

        return () => {
            isCurrent = false;
        };
    }, [externalBodyUrl, open]);

    const handlePrint = () => {
        window.print?.();
    };

    return (
        <RadixDialog open={open} onOpenChange={onOpenChange}>
            <Portal>
                <Overlay className="fixed inset-0 z-[80] bg-[#111827]/35 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <Content
                    aria-describedby={undefined}
                    className="fixed left-1/2 top-1/2 z-[90] flex h-[760px] max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[920px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white px-7 py-6 shadow-[0_22px_48px_rgba(15,23,42,0.22)] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                >
                    <div className="flex min-h-[44px] items-center gap-3.5">
                        <Close asChild>
                            <button
                                type="button"
                                aria-label={t("interactions.detail.modal.back", "Atrás")}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-slate-50 text-gray-700"
                            >
                                <ArrowLeft className="h-[18px] w-[18px]" />
                            </button>
                        </Close>
                        <div className="min-w-0 flex-1">
                            <Title asChild>
                                <h2 className="truncate text-[22px] font-extrabold leading-tight text-[#111827]">
                                    {emailSubject}
                                </h2>
                            </Title>
                            <p className="truncate text-xs font-semibold leading-tight text-gray-600">
                                {sender} &rarr; {recipient}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#2500B8] px-4 text-xs font-bold text-white"
                            >
                                <Printer className="h-[14px] w-[14px]" />
                                {t("interactions.detail.print", "Imprimir")}
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 grid h-[78px] grid-cols-4 gap-3">
                        <SummaryCard
                            icon={CalendarClock}
                            iconClassName="text-violet-600"
                            label={t("interactions.detail.modal.received", "Recepción")}
                            value={formatModalDate(
                                interaction?.receipt_at || interaction?.received_at || interaction?.fecha,
                            )}
                        />
                        <SummaryCard
                            icon={User}
                            iconClassName="text-sky-600"
                            label={t("interactions.detail.from", "De")}
                            value={sender}
                        />
                        <SummaryCard
                            icon={Mail}
                            iconClassName="text-[#37B8BE]"
                            label={t("interactions.detail.to", "Para")}
                            value={recipient}
                        />
                        <SummaryCard
                            icon={BadgeCheck}
                            iconClassName="text-emerald-500"
                            label={t("interactions.detail.modal.priority", "Prioridad")}
                            value={getPriority(interaction, t)}
                        />
                    </div>

                    <section className="mt-[18px] flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white px-4 py-3.5">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-[#2500B8]" />
                            <h3 className="text-[13px] font-extrabold text-[#263238]">
                                {t("interactions.detail.modal.fullContent", "Contenido completo del correo")}
                            </h3>
                        </div>
                        <div className="mt-3 h-px bg-gray-200" />
                        <div className="email-body min-h-0 flex-1 overflow-auto py-4 text-sm font-medium leading-[1.65] text-gray-700">
                            {sanitizedHtmlBody ? (
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html: sanitizedHtmlBody,
                                    }}
                                />
                            ) : (
                                <p className="whitespace-pre-wrap">{fullBodyText}</p>
                            )}
                            {isExternalBodyLoading && (
                                <p className="mt-3 text-xs font-semibold text-gray-400">
                                    {t("interactions.detail.loadingFullBody", "Cargando contenido completo...")}
                                </p>
                            )}
                            {externalBodyLoadFailed && (
                                <p role="alert" className="mt-3 text-xs font-semibold text-red-600">
                                    {t(
                                        "interactions.detail.loadFullBodyError",
                                        "No se pudo cargar el contenido completo. Se muestra la vista previa.",
                                    )}
                                </p>
                            )}
                        </div>
                        <div className="flex h-4 items-center gap-1.5 text-[11px] font-medium text-gray-400">
                            <ChevronDown className="h-[13px] w-[13px]" />
                            <span>
                                {t(
                                    "interactions.detail.modal.scrollHint",
                                    "Vista desplazable si el mensaje es más largo",
                                )}
                            </span>
                        </div>
                    </section>

                    <section className="mt-[18px] flex h-[90px] shrink-0 flex-col gap-2 rounded-lg border border-[#D9F1F3] bg-[#F8FEFF] px-3 py-2">
                        <div className="flex h-5 items-center gap-2">
                            <Paperclip className="h-[15px] w-[15px] text-[#37B8BE]" />
                            <h3 className="truncate text-[13px] font-extrabold text-[#263238]">
                                {t("interactions.detail.modal.emailAttachmentsCount", {
                                    count: attachments.length,
                                    defaultValue: "Adjuntos del correo ({{count}})",
                                })}
                            </h3>
                        </div>
                        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-auto">
                            {attachments.map((attachment, index) => {
                                const attachmentName = getAttachmentName(attachment);
                                const AttachmentIcon = /\.pdf$/i.test(attachmentName) ? FileText : File;

                                return (
                                    <button
                                        key={attachment.id ?? `${attachmentName}-${index}`}
                                        type="button"
                                        onClick={() => attachment.url && onOpenAttachment?.(attachment)}
                                        className="flex h-[38px] min-w-0 items-center gap-2 rounded-md border border-[#D9F1F3] bg-white px-2 text-left"
                                    >
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#BDEBED] bg-[#E6FAFB] text-[#37B8BE]">
                                            <AttachmentIcon className="h-[17px] w-[17px]" />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-xs font-extrabold leading-tight text-[#37B8BE]">
                                            {attachmentName}
                                        </span>
                                        <Download className="h-[15px] w-[15px] shrink-0 text-gray-500" />
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </Content>
            </Portal>
        </RadixDialog>
    );
};

SummaryCard.propTypes = {
    icon: PropTypes.elementType.isRequired,
    iconClassName: PropTypes.string,
    label: PropTypes.string.isRequired,
    value: PropTypes.node.isRequired,
};

InteractionDetailModalContent.propTypes = {
    interaction: PropTypes.object,
    workspaceOptions: PropTypes.array,
    onActionSelect: PropTypes.func,
    onDownloadAttachments: PropTypes.func,
    onOpenAttachment: PropTypes.func,
    onOpenChange: PropTypes.func.isRequired,
    onOpenContent: PropTypes.func,
    reviewButton: PropTypes.shape({
        label: PropTypes.string,
        disabled: PropTypes.bool,
        intent: PropTypes.oneOf(["manage", "release", "readonly"]),
        title: PropTypes.string,
        onClick: PropTypes.func,
    }),
    t: PropTypes.func.isRequired,
};

InteractionFullEmailDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    interaction: PropTypes.object,
    onOpenAttachment: PropTypes.func,
    t: PropTypes.func.isRequired,
};

export default InteractionDetailModalContent;
