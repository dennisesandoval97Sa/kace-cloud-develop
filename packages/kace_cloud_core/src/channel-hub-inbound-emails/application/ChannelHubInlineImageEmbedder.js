export const MAX_INLINE_IMAGE_BYTES_TOTAL = 4 * 1024 * 1024;
export const ALLOWED_INLINE_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const SRC_ATTRIBUTE_PATTERN = /(\s+src\s*=\s*)(["'])(.*?)\2/i;

export class ChannelHubInlineImageEmbedder {
    #downloader;
    #maxBytesTotal;

    constructor({ downloader, maxBytesTotal = MAX_INLINE_IMAGE_BYTES_TOTAL } = {}) {
        this.#downloader = downloader;
        this.#maxBytesTotal = maxBytesTotal;
    }

    async execute(htmlBody) {
        if (htmlBody === null || htmlBody === undefined) {
            return htmlBody;
        }

        const html = String(htmlBody);
        const parts = [];
        let lastIndex = 0;
        let usedBytes = 0;
        const downloadCache = new Map();

        for (const match of html.matchAll(IMG_TAG_PATTERN)) {
            const tag = match[0];
            const tagIndex = match.index;
            parts.push(html.slice(lastIndex, tagIndex));

            const remainingBytes = this.#maxBytesTotal - usedBytes;
            const { tag: rewrittenTag, bytesUsed } =
                remainingBytes <= 0
                    ? { tag, bytesUsed: 0 }
                    : await this.#rewriteImageTag(tag, remainingBytes, downloadCache);
            parts.push(rewrittenTag);
            usedBytes += bytesUsed;

            lastIndex = tagIndex + tag.length;
        }

        parts.push(html.slice(lastIndex));
        return parts.join('');
    }

    async #rewriteImageTag(tag, remainingBytes, downloadCache) {
        const srcMatch = tag.match(SRC_ATTRIBUTE_PATTERN);
        const src = this.#decodeHtmlAttributeValue(srcMatch?.[3]);

        if (!src || !this.#isHttpUrl(src) || typeof this.#downloader?.download !== 'function') {
            return { tag, bytesUsed: 0 };
        }

        try {
            const download = await this.#downloadImage(src, remainingBytes, downloadCache);
            const mimeType = this.#normalizeMimeType(download?.contentType);
            if (!ALLOWED_INLINE_IMAGE_MIME_TYPES.has(mimeType)) {
                return { tag, bytesUsed: 0 };
            }

            const buffer = this.#bufferFrom(download?.buffer);
            if (buffer.length > remainingBytes) {
                return { tag, bytesUsed: 0 };
            }

            const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
            return {
                tag: this.#replaceSrcAttribute(tag, srcMatch, dataUri),
                bytesUsed: buffer.length,
            };
        } catch (_error) {
            return { tag, bytesUsed: 0 };
        }
    }

    #downloadImage(src, remainingBytes, downloadCache) {
        if (!downloadCache.has(src)) {
            downloadCache.set(src, this.#downloader.download(src, { maxBytes: remainingBytes }));
        }

        return downloadCache.get(src);
    }

    #replaceSrcAttribute(tag, srcMatch, dataUri) {
        const [attribute, prefix, quote] = srcMatch;
        const attributeIndex = srcMatch.index;

        return `${tag.slice(0, attributeIndex)}${prefix}${quote}${dataUri}${quote}${tag.slice(
            attributeIndex + attribute.length
        )}`;
    }

    #normalizeMimeType(contentType) {
        return String(contentType ?? '')
            .split(';')[0]
            .trim()
            .toLowerCase();
    }

    #decodeHtmlAttributeValue(value) {
        if (value === null || value === undefined) {
            return value;
        }

        return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, token) => {
            const normalized = token.toLowerCase();
            const namedEntities = {
                amp: '&',
                quot: '"',
                apos: "'",
                lt: '<',
                gt: '>',
            };

            if (Object.prototype.hasOwnProperty.call(namedEntities, normalized)) {
                return namedEntities[normalized];
            }

            const codePoint = normalized.startsWith('#x')
                ? Number.parseInt(normalized.slice(2), 16)
                : Number.parseInt(normalized.slice(1), 10);

            if (!Number.isFinite(codePoint)) {
                return entity;
            }

            try {
                return String.fromCodePoint(codePoint);
            } catch (_error) {
                return entity;
            }
        });
    }

    #isHttpUrl(src) {
        try {
            const url = new URL(src);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_error) {
            return false;
        }
    }

    #bufferFrom(value) {
        if (Buffer.isBuffer(value)) {
            return value;
        }

        if (value instanceof ArrayBuffer) {
            return Buffer.from(value);
        }

        if (ArrayBuffer.isView(value)) {
            return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
        }

        return Buffer.from(value ?? '');
    }
}
