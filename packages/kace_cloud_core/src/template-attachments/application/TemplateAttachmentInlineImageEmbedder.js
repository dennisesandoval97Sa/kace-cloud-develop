export const TEMPLATE_IMAGE_INLINE_MAX_BYTES_TOTAL = 400 * 1024;

const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const TEMPLATE_ATTACHMENT_SRC_PATTERN = /\bsrc\s*=\s*["']template-attachment:\/\/([^"']+)["']/i;
const DATA_FILENAME_PATTERN = /\bdata-filename\s*=\s*["']([^"']*)["']/i;
const DATA_MIME_PATTERN = /\bdata-mime\s*=\s*["']([^"']*)["']/i;

/**
 * Resolves `<img src="template-attachment://<id>">` placeholders (emitted by the RichEditor's
 * ImageNode for images inserted via the template attachments flow) into base64 data-URIs, reading
 * the binary directly from S3 with backend credentials so the embed never depends on a URL that
 * could expire between "template saved" and "email sent".
 *
 * Unlike ChannelHubInlineImageEmbedder (which falls back to the original external URL on failure,
 * since that URL is still potentially resolvable by the recipient's client), a failed or
 * over-budget template-attachment placeholder is dropped entirely: the placeholder scheme is not
 * a real URL, so leaving it in the sent HTML would only render as a broken image icon.
 */
export class TemplateAttachmentInlineImageEmbedder {
    #reader;
    #maxBytesTotal;

    constructor({ reader, maxBytesTotal = TEMPLATE_IMAGE_INLINE_MAX_BYTES_TOTAL } = {}) {
        this.#reader = reader;
        this.#maxBytesTotal = maxBytesTotal;
    }

    async execute(htmlBody, { templateId } = {}) {
        if (htmlBody === null || htmlBody === undefined) {
            return htmlBody;
        }

        const html = String(htmlBody);
        const parts = [];
        let lastIndex = 0;
        let usedBytes = 0;

        for (const match of html.matchAll(IMG_TAG_PATTERN)) {
            const tag = match[0];
            const tagIndex = match.index;
            const srcMatch = tag.match(TEMPLATE_ATTACHMENT_SRC_PATTERN);

            if (!srcMatch) {
                continue;
            }

            parts.push(html.slice(lastIndex, tagIndex));
            lastIndex = tagIndex + tag.length;

            const remainingBytes = this.#maxBytesTotal - usedBytes;
            const { replacement, bytesUsed } =
                remainingBytes <= 0
                    ? { replacement: '', bytesUsed: 0 }
                    : await this.#resolveImage(tag, templateId, remainingBytes);

            parts.push(replacement);
            usedBytes += bytesUsed;
        }

        parts.push(html.slice(lastIndex));
        return parts.join('');
    }

    async #resolveImage(tag, templateId, remainingBytes) {
        const filenameMatch = tag.match(DATA_FILENAME_PATTERN);
        const filename = filenameMatch?.[1];
        if (!templateId || !filename) {
            return { replacement: '', bytesUsed: 0 };
        }

        try {
            const mimeMatch = tag.match(DATA_MIME_PATTERN);
            const attachment = await this.#reader.read({ templateId, filename, contentType: mimeMatch?.[1] });
            const buffer = Buffer.isBuffer(attachment?.content)
                ? attachment.content
                : Buffer.from(attachment?.content ?? '');

            if (buffer.length > remainingBytes) {
                return { replacement: '', bytesUsed: 0 };
            }

            const mimeType = attachment.contentType || 'application/octet-stream';
            const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
            return {
                replacement: tag.replace(TEMPLATE_ATTACHMENT_SRC_PATTERN, `src="${dataUri}"`),
                bytesUsed: buffer.length,
            };
        } catch (_error) {
            return { replacement: '', bytesUsed: 0 };
        }
    }
}
