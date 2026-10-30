import { Filename } from '../../emails/domain/value-object/FileNameAttachment.js';
import { extractChannelHubOriginalFilename } from './ChannelHubAttachmentFilename.js';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

export class ChannelHubInboundAttachmentDownloadError extends Error {
    constructor(code, message, { nonRetryable = false } = {}) {
        super(message);
        this.name = 'ChannelHubInboundAttachmentDownloadError';
        this.code = code;
        this.nonRetryable = nonRetryable;
    }
}

export class ChannelHubInboundAttachmentDownloader {
    #fetchFn;
    #allowedConnectionRepository;
    #timeoutMs;
    #maxBytes;
    #maxRedirects;

    constructor({
        fetchFn = globalThis.fetch,
        allowedConnectionRepository,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        maxBytes = DEFAULT_MAX_BYTES,
        maxRedirects = DEFAULT_MAX_REDIRECTS,
    } = {}) {
        this.#fetchFn = fetchFn;
        this.#allowedConnectionRepository = allowedConnectionRepository;
        this.#timeoutMs = timeoutMs;
        this.#maxBytes = maxBytes;
        this.#maxRedirects = maxRedirects;
    }

    async download(url, { maxBytes } = {}) {
        if (!url) {
            throw new ChannelHubInboundAttachmentDownloadError(
                'missing_attachment_url',
                'Attachment URL is required.',
                { nonRetryable: true }
            );
        }

        if (typeof this.#fetchFn !== 'function') {
            throw new ChannelHubInboundAttachmentDownloadError(
                'attachment_download_unavailable',
                'Attachment downloader is not available.'
            );
        }

        let currentUrl = url;
        const effectiveMaxBytes = this.#effectiveMaxBytes(maxBytes);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

        try {
            for (let redirectCount = 0; redirectCount <= this.#maxRedirects; redirectCount += 1) {
                await this.#assertAllowed(currentUrl);
                const response = await this.#fetchWithSignal(currentUrl, controller.signal);

                if (this.#isRedirect(response)) {
                    const location = response.headers?.get?.('location');
                    if (!location) {
                        throw new ChannelHubInboundAttachmentDownloadError(
                            'invalid_attachment_redirect',
                            'Attachment redirect is missing a Location header.',
                            { nonRetryable: true }
                        );
                    }

                    currentUrl = new URL(location, currentUrl).toString();
                    continue;
                }

                if (!response.ok) {
                    throw new ChannelHubInboundAttachmentDownloadError(
                        'attachment_download_failed',
                        `Attachment download failed with HTTP status ${response.status}.`
                    );
                }

                this.#assertAllowedContentLength(response, effectiveMaxBytes);
                const buffer = await this.#readBodyWithLimits(response, controller.signal, effectiveMaxBytes);

                return {
                    buffer,
                    contentType: response.headers?.get?.('content-type') ?? null,
                    contentLength: buffer.length,
                    filename: Filename.sanitize(
                        this.#filenameFromContentDisposition(response) ?? this.#filenameFromUrl(currentUrl)
                    ),
                    finalUrl: currentUrl,
                };
            }

            throw new ChannelHubInboundAttachmentDownloadError(
                'too_many_attachment_redirects',
                'Attachment download exceeded the redirect limit.',
                { nonRetryable: true }
            );
        } finally {
            clearTimeout(timeout);
        }
    }

    #effectiveMaxBytes(maxBytes) {
        const perCallMaxBytes = Number(maxBytes);
        if (Number.isFinite(perCallMaxBytes) && perCallMaxBytes >= 0) {
            return Math.min(this.#maxBytes, perCallMaxBytes);
        }

        return this.#maxBytes;
    }

    async #assertAllowed(url) {
        if (!this.#allowedConnectionRepository) {
            return;
        }

        const allowed = await this.#allowedConnectionRepository.isAllowedConnection(url);
        if (!allowed) {
            throw new ChannelHubInboundAttachmentDownloadError(
                'untrusted_attachment_url',
                'Attachment URL host is not trusted.',
                { nonRetryable: true }
            );
        }
    }

    async #fetchWithSignal(url, signal) {
        try {
            return await this.#fetchFn(url, {
                redirect: 'manual',
                signal,
            });
        } catch (error) {
            const isAbort = error?.name === 'AbortError';
            throw new ChannelHubInboundAttachmentDownloadError(
                isAbort ? 'attachment_download_timeout' : 'attachment_download_failed',
                isAbort ? 'Attachment download timed out.' : 'Attachment download failed.'
            );
        }
    }

    async #readBodyWithLimits(response, signal, maxBytes) {
        if (typeof response.body?.getReader === 'function') {
            return this.#readStreamWithLimits(response.body.getReader(), signal, maxBytes);
        }

        if (typeof response.arrayBuffer !== 'function') {
            throw new ChannelHubInboundAttachmentDownloadError(
                'attachment_download_failed',
                'Attachment response cannot be read.'
            );
        }

        try {
            const arrayBuffer = await this.#withAbort(response.arrayBuffer(), signal);
            const buffer = Buffer.from(arrayBuffer);
            this.#assertAllowedBufferLength(buffer, maxBytes);
            return buffer;
        } catch (error) {
            if (error instanceof ChannelHubInboundAttachmentDownloadError) {
                throw error;
            }

            const isAbort = error?.name === 'AbortError';
            throw new ChannelHubInboundAttachmentDownloadError(
                isAbort ? 'attachment_download_timeout' : 'attachment_download_failed',
                isAbort ? 'Attachment download timed out.' : 'Attachment download failed.'
            );
        }
    }

    async #readStreamWithLimits(reader, signal, maxBytes) {
        const chunks = [];
        let bytesRead = 0;

        try {
            while (true) {
                const { done, value } = await this.#withAbort(reader.read(), signal);
                if (done) {
                    return Buffer.concat(chunks, bytesRead);
                }

                const chunk = Buffer.from(value);
                if (bytesRead + chunk.length > maxBytes) {
                    await reader.cancel?.();
                    throw new ChannelHubInboundAttachmentDownloadError(
                        'attachment_too_large',
                        `Attachment exceeds ${maxBytes} bytes.`,
                        { nonRetryable: true }
                    );
                }

                chunks.push(chunk);
                bytesRead += chunk.length;
            }
        } catch (error) {
            if (error instanceof ChannelHubInboundAttachmentDownloadError) {
                throw error;
            }

            const isAbort = error?.name === 'AbortError';
            throw new ChannelHubInboundAttachmentDownloadError(
                isAbort ? 'attachment_download_timeout' : 'attachment_download_failed',
                isAbort ? 'Attachment download timed out.' : 'Attachment download failed.'
            );
        } finally {
            reader.releaseLock?.();
        }
    }

    #withAbort(promise, signal) {
        if (signal.aborted) {
            return Promise.reject(
                new ChannelHubInboundAttachmentDownloadError(
                    'attachment_download_timeout',
                    'Attachment download timed out.'
                )
            );
        }

        return new Promise((resolve, reject) => {
            const onAbort = () =>
                reject(
                    new ChannelHubInboundAttachmentDownloadError(
                        'attachment_download_timeout',
                        'Attachment download timed out.'
                    )
                );
            signal.addEventListener('abort', onAbort, { once: true });
            Promise.resolve(promise).then(
                (value) => {
                    signal.removeEventListener('abort', onAbort);
                    resolve(value);
                },
                (error) => {
                    signal.removeEventListener('abort', onAbort);
                    reject(error);
                }
            );
        });
    }

    #isRedirect(response) {
        return response.status >= 300 && response.status < 400;
    }

    #assertAllowedContentLength(response, maxBytes) {
        const contentLength = Number(response.headers?.get?.('content-length'));
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
            throw new ChannelHubInboundAttachmentDownloadError(
                'attachment_too_large',
                `Attachment exceeds ${maxBytes} bytes.`,
                { nonRetryable: true }
            );
        }
    }

    #assertAllowedBufferLength(buffer, maxBytes) {
        if (buffer.length > maxBytes) {
            throw new ChannelHubInboundAttachmentDownloadError(
                'attachment_too_large',
                `Attachment exceeds ${maxBytes} bytes.`,
                { nonRetryable: true }
            );
        }
    }

    #filenameFromContentDisposition(response) {
        const contentDisposition = response.headers?.get?.('content-disposition');
        if (!contentDisposition) {
            return null;
        }

        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match?.[1]) {
            return Filename.sanitize(decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, '')));
        }

        const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
        return filenameMatch?.[1] ? Filename.sanitize(filenameMatch[1]) : null;
    }

    #filenameFromUrl(url) {
        try {
            const pathname = new URL(url).pathname;
            const filename = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '');
            return filename ? Filename.sanitize(extractChannelHubOriginalFilename(filename)) : null;
        } catch (_error) {
            return null;
        }
    }
}
