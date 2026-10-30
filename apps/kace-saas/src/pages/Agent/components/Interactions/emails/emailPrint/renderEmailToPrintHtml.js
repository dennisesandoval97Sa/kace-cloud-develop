import DOMPurify from "dompurify";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PRIORITY_LABELS } from "../EmailDetail";
import { getEmailBodyContent, plainTextToHtml, escapeHtml } from "../emailBodyContent";
import { getAttachmentDisplayName } from "../attachmentDisplayName";
import { emailPrintStyles } from "./emailPrintStyles";

export const renderEmailToPrintHtml = ({ email, t }) => {
    if (!email) return "";
    const bodyContent = getEmailBodyContent(email);
    const safeHtml = bodyContent.html
        ? DOMPurify.sanitize(bodyContent.html)
        : bodyContent.plain
          ? plainTextToHtml(bodyContent.plain)
          : `<p>${t("genericTexts.noContent")}</p>`;
    const attachments = email.attachments ?? email.attachment ?? [];

    const formattedDate = email.received_at
        ? format(new Date(email.received_at), "dd/MM/yyyy HH:mm", { locale: es })
        : t("genericTexts.notAvailable");

    const subject = email.subject
        ? email.subject.startsWith("Re:")
            ? email.subject
            : `Re: ${email.subject}`
        : t("genericTexts.noSubject");

    const priorityLabel = PRIORITY_LABELS[email.priority] ?? PRIORITY_LABELS.normal;

    return `
   <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="utf-8" />
        <title>${subject}</title>

        <style>
            ${emailPrintStyles}
        </style>
    </head>

    <body>

        <h1>${subject}</h1>

        <div class="meta">
            <div class="meta-item">
                <strong>${t("interactions.detail.received")}:</strong>
                ${formattedDate}
            </div>

            <div class="meta-item">
                <strong>${t("interactions.detail.from")}:</strong>
                ${email.sender ?? "-"}
            </div>

            <div class="meta-item">
                <strong>${t("interactions.detail.to")}:</strong>
                ${email.to?.map((t) => t.email).join(", ") ?? "-"}
            </div>

            <div class="meta-item">
                <strong>${t("interactions.detail.priority")}:</strong>
                ${t(priorityLabel)}
            </div>
        </div>

        <div class="section-title">
            ${t("interactions.detail.content")}
        </div>

        <div class="content email-html">
            ${safeHtml}
        </div>

        ${
            attachments.length
                ? `
                    <div class="section-title">
                        ${t("interactions.detail.attachments")} (${attachments.length})
                    </div>

                    <div class="attachments">
                        ${attachments
                            .map(
                                (file) => `
                                    <div class="attachment">
                                        ${escapeHtml(getAttachmentDisplayName(file))}${file.size ? ` (${escapeHtml(file.size)})` : ""}
                                    </div>
                                `,
                            )
                            .join("")}
                    </div>
                `
                : ""
        }

        <footer>
            ${new Date().toLocaleString()}
        </footer>

    </body>
    </html>
    `;
};
