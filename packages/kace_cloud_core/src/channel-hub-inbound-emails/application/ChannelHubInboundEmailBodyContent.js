import { createHash } from 'node:crypto';

export const INLINE_EMAIL_BODY_MAX_BYTES = 1024 * 1024;
export const MAX_PLAIN_TEXT_BODY_BYTES = INLINE_EMAIL_BODY_MAX_BYTES;
export const EXTERNAL_EMAIL_BODY_MAX_BYTES = Number(
    process.env.CHANNEL_HUB_EXTERNAL_BODY_MAX_BYTES ?? 10 * 1024 * 1024
);
export const BODY_PREVIEW_MAX_CHARS = Number(process.env.CHANNEL_HUB_BODY_PREVIEW_MAX_CHARS ?? 8 * 1024);
export const BODY_STORAGE_MODE_INLINE = 'inline';
export const BODY_STORAGE_MODE_EXTERNAL = 'external';

export function bodyBuffer(downloadOrValue) {
    const value = downloadOrValue?.buffer ?? downloadOrValue;

    if (Buffer.isBuffer(value)) {
        return value;
    }

    if (value instanceof ArrayBuffer) {
        return Buffer.from(value);
    }

    if (value instanceof Uint8Array) {
        return Buffer.from(value);
    }

    return Buffer.from(value ?? '', 'utf8');
}

export function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

export function stripHtmlToText(html = '') {
    return String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .trim();
}

export function previewFromText(text = '', maxChars = BODY_PREVIEW_MAX_CHARS) {
    const normalized = String(text ?? '');
    return {
        preview: normalized.slice(0, maxChars),
        truncated: normalized.length > maxChars,
    };
}

export function previewFromHtml(html = '', maxChars = BODY_PREVIEW_MAX_CHARS) {
    return previewFromText(stripHtmlToText(html), maxChars);
}

export function isHtmlContent({ contentType, body, url } = {}) {
    return (
        /html/i.test(String(contentType ?? '')) ||
        /\.html(?:$|\?)/i.test(String(url ?? '')) ||
        /<\s*html|<\s*body|<\s*(article|div|p|table|span|br)\b/i.test(String(body ?? ''))
    );
}
