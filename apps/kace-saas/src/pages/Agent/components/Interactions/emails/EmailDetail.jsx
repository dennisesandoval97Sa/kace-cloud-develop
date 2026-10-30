import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Calendar, Download, Mail, Paperclip, Tag, User } from "lucide-react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HandleEmailPrint } from "./emailPrint/HandleEmailPrint";
import { apiService } from "@kace/utils";
import { downloadAttachment } from "../utils/downloadAttachment";
import { openAttachment } from "../utils/openAttachment";
import { Button } from "@/components/ui-shared";
import DOMPurify from "dompurify";
import { getEmailBodyContent } from "./emailBodyContent";
import { getAttachmentDisplayName } from "./attachmentDisplayName";
import { getTranslatedError } from "@/utils/getTranslatedError";

export const PRIORITY_LABELS = {
    low: "interactions.detail.low",
    normal: "interactions.detail.normal",
    high: "interactions.detail.high",
};

// El detalle de email del backend aplana los destinatarios a strings
// (EmailDetailFinder: `flatEmails`), así que `to` llega como ["a@b.com", ...].
// Se tolera también el formato objeto {email|address|name} por robustez.
export const formatRecipients = (recipients) =>
    (Array.isArray(recipients) ? recipients : [recipients])
        .map((entry) => (typeof entry === "string" ? entry : (entry?.email ?? entry?.address ?? entry?.name ?? "")))
        .filter(Boolean)
        .join(", ");

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

const EmailDetail = ({ email, onBack }) => {
    const { t } = useTranslation();

    const handleOpenAttachment = async (file) => {
        try {
            await openAttachment(file);
        } catch (error) {
            console.error("[EmailDetail] openAttachment failed", error);
            toast.error(getTranslatedError(error, t) || t("interactions.detail.openAttachmentError"));
        }
    };

    const handleDownloadAttachment = async (file) => {
        try {
            await downloadAttachment(file);
        } catch (error) {
            console.error("[EmailDetail] downloadAttachment failed", error);
            toast.error(getTranslatedError(error, t) || t("interactions.detail.downloadAttachmentError"));
        }
    };

    const emailId = email?.id;
    const emailBody = email?.body;
    const emailBodyContent = useMemo(() => getEmailBodyContent({ body: emailBody }), [emailBody]);
    const [externalBodyState, setExternalBodyState] = useState(EMPTY_EXTERNAL_BODY_STATE);

    const handlePrintEmail = HandleEmailPrint({ email });

    useEffect(() => {
        setExternalBodyState(EMPTY_EXTERNAL_BODY_STATE);
    }, [emailId, emailBodyContent.bodyUrl]);

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

    if (!email) {
        return (
            <div className="border rounded-lg bg-white h-[calc(100vh-330px)] flex items-center justify-center">
                <div className="text-center text-gray-400">
                    <Mail className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-lg">{t("interactions.detail.selectEmail")}</p>
                </div>
            </div>
        );
    }

    const { subject, sender, to = [], priority, attachment = [], attachments = [], received_at } = email;
    const renderedAttachments = attachments?.length ? attachments : (attachment ?? []);
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
    const sanitizedHtmlBody = renderedBodyContent.html ? DOMPurify.sanitize(renderedBodyContent.html) : null;
    const showExternalBodyControls = emailBodyContent.isExternal && !hasLoadedExternalBody;
    const isExternalBodyLoading = externalBodyState.status === "loading";
    const externalBodyLoadFailed = externalBodyState.status === "error";

    const formattedReceivedAt = received_at
        ? format(new Date(received_at), "dd/MM/yyyy HH:mm", { locale: es })
        : t("interactions.detail.notAvailable");

    const priorityLabel = PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.normal;
    const recipientsLabel = formatRecipients(to) || t("interactions.detail.notAvailable");

    return (
        <div className="email-detail-print" id="email-detail-print">
            <div className="border rounded-lg bg-white overflow-hidden h-[calc(100vh-330px)] flex flex-col">
                <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {subject ? `Re: ${subject}` : t("interactions.detail.noSubject")}
                    </h3>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePrintEmail}
                        className="border border-input hover:text-accent-foreground items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 h-10 flex gap-1"
                    >
                        {t("interactions.detail.print")}
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onBack}
                        className="p-2 rounded-lg hover:bg-gray-200 transition"
                        title={t("interactions.detail.back")}
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-700" />
                    </Button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center text-sm text-gray-600">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="font-medium mr-2">{t("interactions.detail.received")}:</span>
                            <span>{formattedReceivedAt}</span>
                        </div>

                        <div className="flex items-center text-sm text-gray-600">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="font-medium mr-2">{t("interactions.detail.from")}:</span>
                            <span>{sender || t("interactions.detail.notAvailable")}</span>
                        </div>

                        <div className="flex items-center text-sm text-gray-600">
                            <Mail className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="font-medium mr-2">{t("interactions.detail.to")}:</span>
                            <span>{recipientsLabel}</span>
                        </div>

                        <div className="flex items-center text-sm text-gray-600">
                            <Tag className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="font-medium mr-2">{t("interactions.detail.priority")}:</span>
                            <span>{t(priorityLabel)}</span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">{t("interactions.detail.content")}</h4>
                        {sanitizedHtmlBody ? (
                            <div
                                className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed email-body"
                                dangerouslySetInnerHTML={{
                                    __html: sanitizedHtmlBody,
                                }}
                            />
                        ) : (
                            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed email-body whitespace-pre-wrap">
                                {renderedBodyContent.plain || t("genericTexts.noContent")}
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
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleLoadExternalBody}
                                        disabled={isExternalBodyLoading}
                                    >
                                        {isExternalBodyLoading
                                            ? t("interactions.detail.loadingFullBody", {
                                                  defaultValue: "Loading full body...",
                                              })
                                            : t("interactions.detail.loadFullBody", {
                                                  defaultValue: "Load full body",
                                              })}
                                    </Button>
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

                    <div className="flex flex-wrap gap-2">
                        {renderedAttachments.map((file) => (
                            <div
                                key={file.id}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleOpenAttachment(file)}
                                    className="flex items-center text-left hover:underline"
                                    title={t("interactions.detail.viewAttachment")}
                                >
                                    <Paperclip className="w-4 h-4 mr-2 text-gray-500" />
                                    <span>{getAttachmentDisplayName(file)}</span>
                                    {file.size && <span className="ml-2 text-xs text-gray-500">({file.size})</span>}
                                </button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadAttachment(file)}
                                    title={t("common.download")}
                                    className="p-1 hover:bg-gray-200 rounded-lg"
                                >
                                    <Download className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const emailBodyPartMetadataPropTypes = PropTypes.shape({
    mode: PropTypes.string,
    bodyUrl: PropTypes.string,
    body_url: PropTypes.string,
    size_bytes: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    content_type: PropTypes.string,
    contentType: PropTypes.string,
    preview_truncated: PropTypes.bool,
    previewTruncated: PropTypes.bool,
});

EmailDetail.propTypes = {
    email: PropTypes.shape({
        id: PropTypes.string,
        subject: PropTypes.string,
        sender: PropTypes.string,
        to: PropTypes.arrayOf(
            PropTypes.oneOfType([
                PropTypes.string,
                PropTypes.shape({
                    name: PropTypes.string,
                    email: PropTypes.string,
                }),
            ]),
        ),
        priority: PropTypes.oneOf(["low", "normal", "high"]),
        attachment: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.string,
                filename: PropTypes.string,
                name: PropTypes.string,
                size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                url: PropTypes.string,
            }),
        ),
        attachments: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.string,
                filename: PropTypes.string,
                name: PropTypes.string,
                size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                url: PropTypes.string,
            }),
        ),
        body: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.shape({
                body: PropTypes.string,
                body_html: PropTypes.string,
                text: emailBodyPartMetadataPropTypes,
                html: emailBodyPartMetadataPropTypes,
            }),
        ]),
        received_at: PropTypes.string,
    }),
    onBack: PropTypes.func.isRequired,
};

export default EmailDetail;
