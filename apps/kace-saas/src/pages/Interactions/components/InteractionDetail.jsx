import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import DOMPurify from "dompurify";
import { Mail, Clock, Calendar, User, Tag, Paperclip } from "lucide-react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { apiService } from "@kace/utils";
import { getEmailBodyContent } from "../../Agent/components/Interactions/emails/emailBodyContent";
import { getAttachmentName, getInteractionAttachments, getInteractionSubject } from "../utils/interactionDisplayUtils";

const getInteractionStatus = ({ in_review, is_closed, status }) => {
    if (status) return status;
    if (is_closed) return "Cerrada";
    if (in_review) return "En revisión";
    return "Creada";
};

const truncateAttachmentName = (name, maxLength = 32) => {
    if (!name || name.length <= maxLength) return name;

    const extension = name.match(/(\.[a-zA-Z0-9]{1,20})$/)?.[1] ?? "";
    const separator = extension ? "..." : "....";
    const prefixLength = Math.max(maxLength - separator.length - extension.length, 1);

    return `${name.slice(0, prefixLength)}${separator}${extension}`;
};

const formatInteractionDate = (value) => {
    if (!value) return "—";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return format(date, "dd/MM/yyyy HH:mm", { locale: es });
};

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

const InteractionDetail = ({ interaction, onOpenAttachment }) => {
    const { t } = useTranslation();
    const interactionId = interaction?.id ?? null;
    const interactionBody = interaction?.body;
    const emailBodyContent = useMemo(() => getEmailBodyContent({ body: interactionBody }), [interactionBody]);
    const [externalBodyState, setExternalBodyState] = useState(EMPTY_EXTERNAL_BODY_STATE);

    useEffect(() => {
        setExternalBodyState(EMPTY_EXTERNAL_BODY_STATE);
    }, [interactionId, emailBodyContent.bodyUrl]);

    const handleLoadExternalBody = async () => {
        if (!emailBodyContent.bodyUrl) {
            return;
        }

        setExternalBodyState((current) => ({
            ...current,
            status: "loading",
            error: null,
        }));

        try {
            const response = await apiService.get(emailBodyContent.bodyUrl);
            const bodyResponse = normalizeExternalBodyResponse(response);

            setExternalBodyState({
                status: "loaded",
                content: bodyResponse.content,
                contentType: bodyResponse.contentType,
                part: bodyResponse.part,
                error: null,
            });
        } catch (error) {
            setExternalBodyState({
                ...EMPTY_EXTERNAL_BODY_STATE,
                status: "error",
                error,
            });
        }
    };

    if (!interaction) {
        return (
            <div className="border rounded-lg bg-white p-8 h-[calc(100vh-330px)] flex items-center justify-center">
                <div className="text-center text-gray-500">
                    <Mail size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>{t("interactions.detail.selectInteraction")}</p>
                </div>
            </div>
        );
    }

    const getBadgeColor = (status) => {
        switch (status) {
            case "En revisión":
                return "bg-yellow-100 text-yellow-700 border-yellow-200";
            case "Creada":
                return "bg-blue-100 text-blue-700 border-blue-200";
            case "Cerrada":
                return "bg-gray-100 text-gray-700 border-gray-200";
            default:
                return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    const status = getInteractionStatus(interaction);
    const subject = getInteractionSubject(interaction);
    const receivedAt = interaction.receipt_at || interaction.fecha || interaction.created_at;
    const reviewedAt = interaction.start_review_at || interaction.fechaRevision;
    const attachments = getInteractionAttachments(interaction);
    const hasLoadedExternalBody = emailBodyContent.isExternal && externalBodyState.status === "loaded";
    const loadedExternalBodyIsHtml =
        hasLoadedExternalBody &&
        shouldRenderExternalContentAsHtml({
            preferredPart: emailBodyContent.preferredPart,
            contentType: externalBodyState.contentType ?? emailBodyContent.contentType,
            part: externalBodyState.part,
        });
    const renderedBodyContent = hasLoadedExternalBody
        ? {
              plain: loadedExternalBodyIsHtml ? "" : externalBodyState.content,
              html: loadedExternalBodyIsHtml ? externalBodyState.content : "",
          }
        : {
              plain: emailBodyContent.plain,
              html: emailBodyContent.isExternal ? "" : emailBodyContent.html,
          };
    const sanitizedHtmlBody = renderedBodyContent.html ? DOMPurify.sanitize(renderedBodyContent.html) : "";
    const plainEmailBody = renderedBodyContent.plain ?? "";
    const hasHtmlBody = sanitizedHtmlBody.trim().length > 0;
    const hasPlainBody = String(plainEmailBody).trim().length > 0;
    const showExternalBodyControls = emailBodyContent.isExternal && !hasLoadedExternalBody;
    const isExternalBodyLoading = externalBodyState.status === "loading";
    const externalBodyLoadFailed = externalBodyState.status === "error";

    return (
        <div className="border rounded-lg bg-white overflow-hidden h-[calc(100vh-330px)] flex flex-col">
            <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">{subject}</h2>
                        <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getBadgeColor(status)}`}
                        >
                            {status}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                            {t("interactions.detail.release")}
                        </button>
                        <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium">
                            {t("interactions.detail.close")}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-start gap-3">
                        <Calendar className="text-gray-400 mt-0.5" size={20} />
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">
                                {t("interactions.detail.received")}
                            </p>
                            <p className="text-sm text-gray-900 font-medium">{formatInteractionDate(receivedAt)}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Clock className="text-gray-400 mt-0.5" size={20} />
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">
                                {t("interactions.detail.reviewed")}
                            </p>
                            <p className="text-sm text-gray-900 font-medium">{formatInteractionDate(reviewedAt)}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <User className="text-gray-400 mt-0.5" size={20} />
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">
                                {t("interactions.detail.from")}
                            </p>
                            <p className="text-sm text-gray-900 font-medium">{interaction.client_identifier || "—"}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Tag className="text-gray-400 mt-0.5" size={20} />
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">
                                {t("interactions.detail.priority")}
                            </p>
                            <p className="text-sm text-gray-900 font-medium">
                                {interaction.priority || t("interactions.detail.normal")}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                        {t("interactions.detail.content")}
                    </h3>
                    {hasHtmlBody ? (
                        <div
                            className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed email-body"
                            dangerouslySetInnerHTML={{
                                __html: sanitizedHtmlBody,
                            }}
                        />
                    ) : (
                        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed email-body whitespace-pre-wrap">
                            {hasPlainBody ? plainEmailBody : t("genericTexts.noContent")}
                        </div>
                    )}

                    {showExternalBodyControls && (
                        <div className="mt-3 space-y-2 text-sm text-gray-600">
                            <p>
                                {t("interactions.detail.externalBodyPreview", {
                                    defaultValue: "This message body is large. The preview is shown above.",
                                })}
                            </p>

                            {emailBodyContent.bodyUrl ? (
                                <button
                                    type="button"
                                    onClick={handleLoadExternalBody}
                                    disabled={isExternalBodyLoading}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isExternalBodyLoading
                                        ? t("interactions.detail.loadingFullBody", {
                                              defaultValue: "Loading full body...",
                                          })
                                        : t("interactions.detail.loadFullBody", {
                                              defaultValue: "Load full body",
                                          })}
                                </button>
                            ) : (
                                <p role="alert" className="text-sm text-red-600">
                                    {t("interactions.detail.fullBodyUnavailable", {
                                        defaultValue: "Full body is unavailable.",
                                    })}
                                </p>
                            )}

                            {externalBodyLoadFailed && (
                                <p role="alert" className="text-sm text-red-600">
                                    {t("interactions.detail.loadFullBodyError", {
                                        defaultValue: "Unable to load full body. Preview is still shown.",
                                    })}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {attachments.length > 0 && (
                    <div className="border-t mt-6 pt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Paperclip size={18} className="text-gray-400" />
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                {t("interactions.detail.attachments")}
                            </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {attachments.map((attachment, index) => {
                                const attachmentName = getAttachmentName(attachment);
                                const displayName = truncateAttachmentName(attachmentName);
                                const content = (
                                    <>
                                        <Paperclip size={14} />
                                        <span>{displayName}</span>
                                        {attachment.size && (
                                            <span className="text-xs text-gray-500">({attachment.size})</span>
                                        )}
                                    </>
                                );
                                const className =
                                    "flex items-center gap-2 max-w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-colors";

                                return attachment.url ? (
                                    <button
                                        key={attachment.id ?? `${attachmentName}-${index}`}
                                        type="button"
                                        onClick={() => onOpenAttachment?.(attachment)}
                                        title={attachmentName}
                                        className={`${className} cursor-pointer text-left`}
                                    >
                                        {content}
                                    </button>
                                ) : (
                                    <div
                                        key={attachment.id ?? `${attachmentName}-${index}`}
                                        title={attachmentName}
                                        className={className}
                                    >
                                        {content}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

InteractionDetail.propTypes = {
    interaction: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        fecha: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
        receipt_at: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
        created_at: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
        start_review_at: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
        fechaRevision: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
        asunto: PropTypes.string,
        description: PropTypes.string,
        subject: PropTypes.string,
        status: PropTypes.string,
        client_identifier: PropTypes.string,
        priority: PropTypes.string,
        body: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.shape({
                body: PropTypes.string,
                body_html: PropTypes.string,
            }),
        ]),
        in_review: PropTypes.bool,
        is_closed: PropTypes.bool,
        attachment: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                filename: PropTypes.string,
                name: PropTypes.string,
                nombre: PropTypes.string,
                url: PropTypes.string,
                size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            }),
        ),
        attachments: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                filename: PropTypes.string,
                name: PropTypes.string,
                nombre: PropTypes.string,
                url: PropTypes.string,
                size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            }),
        ),
    }),
    onOpenAttachment: PropTypes.func,
};

export default InteractionDetail;
