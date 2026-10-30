export const sanitizeAttachmentFilename = (value, fallback = "attachment") => {
    const raw = value == null ? "" : String(value);
    const basename =
        raw
            .replace(/[\u0000-\u001f\u007f]/g, "")
            .split(/[\\/]/)
            .filter(Boolean)
            .pop() ?? "";
    const sanitized = basename
        .trim()
        .replace(/^[.\s]+|[.\s]+$/g, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[+&=% ]/g, "-")
        .replace(/[^a-zA-Z0-9.\-_]/g, "")
        .toLowerCase()
        .replace(/^[.\s]+|[.\s]+$/g, "");

    if (!sanitized) return fallback;
    if (sanitized.length <= 255) return sanitized;

    const extension = sanitized.match(/(\.[a-z0-9]{1,20})$/)?.[1] ?? "";
    const baseMaxLength = Math.max(255 - extension.length, 1);
    return `${sanitized.slice(0, baseMaxLength)}${extension}`;
};

export const getAttachmentDisplayName = (file) => sanitizeAttachmentFilename(file?.filename || file?.name);
