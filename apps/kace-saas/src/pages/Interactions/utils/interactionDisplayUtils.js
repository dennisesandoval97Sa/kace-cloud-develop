export const getInteractionSubject = (interaction) =>
    interaction?.description || interaction?.subject || interaction?.asunto || "";

export const getInteractionAttachments = (interaction) => {
    const attachments = interaction?.attachments ?? interaction?.attachment ?? [];
    return Array.isArray(attachments) ? attachments : [];
};

export const filenameFromUrl = (url) => {
    if (!url) return null;

    try {
        const pathname = new URL(url).pathname;
        const filename = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
        return filename || null;
    } catch {
        const [pathWithoutQuery] = String(url).split("?");
        return pathWithoutQuery.split("/").filter(Boolean).pop() || null;
    }
};

export const getAttachmentName = (attachment) =>
    attachment?.filename || attachment?.name || attachment?.nombre || filenameFromUrl(attachment?.url) || "attachment";
