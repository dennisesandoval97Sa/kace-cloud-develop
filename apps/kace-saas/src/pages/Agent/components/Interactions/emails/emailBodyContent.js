const INLINE_MODE = "inline";
const EXTERNAL_MODE = "external";

const EMPTY_BODY_CONTENT = {
    plain: "",
    html: "",
    preferredPart: "text",
    bodyUrl: null,
    isExternal: false,
    previewTruncated: false,
    contentType: null,
    mode: INLINE_MODE,
};

const normalizeBodyPart = (part) => {
    if (!part || typeof part !== "object") {
        return {
            mode: INLINE_MODE,
            bodyUrl: null,
            previewTruncated: false,
            contentType: null,
        };
    }

    return {
        mode: part.mode ?? INLINE_MODE,
        bodyUrl: part.bodyUrl ?? part.body_url ?? null,
        previewTruncated: Boolean(part.preview_truncated ?? part.previewTruncated ?? false),
        contentType: part.content_type ?? part.contentType ?? null,
    };
};

const hasInlineHtml = (html) => typeof html === "string" && html.length > 0;

export const getEmailBodyContent = (email) => {
    const body = email?.body;

    if (body && typeof body === "object") {
        const plain = body.body ?? "";
        const html = body.body_html ?? "";
        const textPart = normalizeBodyPart(body.text);
        const htmlPart = normalizeBodyPart(body.html);

        if (htmlPart.mode === EXTERNAL_MODE) {
            return {
                plain,
                html: "",
                preferredPart: "html",
                bodyUrl: htmlPart.bodyUrl,
                isExternal: true,
                previewTruncated: htmlPart.previewTruncated,
                contentType: htmlPart.contentType,
                mode: EXTERNAL_MODE,
            };
        }

        if (hasInlineHtml(html)) {
            return {
                plain,
                html,
                preferredPart: "html",
                bodyUrl: null,
                isExternal: false,
                previewTruncated: Boolean(htmlPart.previewTruncated),
                contentType: htmlPart.contentType,
                mode: INLINE_MODE,
            };
        }

        if (textPart.mode === EXTERNAL_MODE) {
            return {
                plain,
                html: "",
                preferredPart: "text",
                bodyUrl: textPart.bodyUrl,
                isExternal: true,
                previewTruncated: textPart.previewTruncated,
                contentType: textPart.contentType,
                mode: EXTERNAL_MODE,
            };
        }

        return {
            plain,
            html,
            preferredPart: "text",
            bodyUrl: null,
            isExternal: false,
            previewTruncated: Boolean(textPart.previewTruncated),
            contentType: textPart.contentType,
            mode: INLINE_MODE,
        };
    }

    return {
        ...EMPTY_BODY_CONTENT,
        plain: body ?? "",
    };
};

export const escapeHtml = (value = "") =>
    String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

export const plainTextToHtml = (value = "") => escapeHtml(value).replace(/\r?\n/g, "<br />");
