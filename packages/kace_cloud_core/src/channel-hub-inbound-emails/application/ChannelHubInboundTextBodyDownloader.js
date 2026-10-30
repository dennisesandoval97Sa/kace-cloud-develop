import { EXTERNAL_EMAIL_BODY_MAX_BYTES } from './ChannelHubInboundEmailBodyContent.js';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_REDIRECTS = 3;
const BODY_KIND_LABELS = {
    text: 'Plain-text body',
    html: 'HTML body',
};

export class ChannelHubInboundTextBodyDownloadError extends Error {
    constructor(code, message, { nonRetryable = true } = {}) {
        super(message);
        this.name = 'ChannelHubInboundTextBodyDownloadError';
        this.code = code;
        this.nonRetryable = nonRetryable;
    }
}

export class ChannelHubInboundTextBodyDownloader {
    #fetchFn;
    #allowedConnectionRepository;
    #timeoutMs;
    #maxBytes;
    #maxRedirects;

    constructor({
        fetchFn = globalThis.fetch,
        allowedConnectionRepository,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        maxBytes = EXTERNAL_EMAIL_BODY_MAX_BYTES,
        maxRedirects = DEFAULT_MAX_REDIRECTS,
    } = {}) {
        this.#fetchFn = fetchFn;
        this.#allowedConnectionRepository = allowedConnectionRepository;
        this.#timeoutMs = timeoutMs;
        this.#maxBytes = maxBytes;
        this.#maxRedirects = maxRedirects;
    }

    async download(url, { kind = 'text' } = {}) {
        const bodyKind = this.#bodyKind(kind);

        if (!url) {
            throw this.#error(bodyKind, 'missing_url', `${bodyKind.label} URL is required.`);
        }

        if (typeof this.#fetchFn !== 'function') {
            throw this.#error(bodyKind, 'download_unavailable', `${bodyKind.label} downloader is not available.`, {
                nonRetryable: false,
            });
        }

        let currentUrl = url;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

        try {
            for (let redirectCount = 0; redirectCount <= this.#maxRedirects; redirectCount += 1) {
                await this.#assertAllowed(currentUrl, bodyKind);
                const response = await this.#fetchWithSignal(currentUrl, controller.signal, bodyKind);

                if (this.#isRedirect(response)) {
                    const location = response.headers?.get?.('location');
                    if (!location) {
                        throw this.#error(
                            bodyKind,
                            'invalid_redirect',
                            `${bodyKind.label} redirect is missing a Location header.`
                        );
                    }

                    currentUrl = new URL(location, currentUrl).toString();
                    continue;
                }

                if (!response.ok) {
                    throw this.#error(
                        bodyKind,
                        'download_failed',
                        `${bodyKind.label} download failed with HTTP status ${response.status}.`,
                        { nonRetryable: false }
                    );
                }

                this.#assertAllowedContentLength(response, bodyKind);
                const buffer = await this.#readBodyWithLimits(response, controller.signal, bodyKind);

                return {
                    buffer,
                    contentType: response.headers?.get?.('content-type') ?? null,
                    contentLength: buffer.length,
                    finalUrl: currentUrl,
                };
            }

            throw this.#error(
                bodyKind,
                'too_many_redirects',
                `${bodyKind.label} download exceeded the redirect limit.`
            );
        } finally {
            clearTimeout(timeout);
        }
    }

    async #assertAllowed(url, bodyKind) {
        if (!this.#allowedConnectionRepository) {
            return;
        }

        const allowed = await this.#allowedConnectionRepository.isAllowedConnection(url);
        if (!allowed) {
            throw this.#error(bodyKind, 'untrusted_url', `${bodyKind.label} URL host is not trusted.`);
        }
    }

    async #fetchWithSignal(url, signal, bodyKind) {
        try {
            return await this.#fetchFn(url, {
                redirect: 'manual',
                signal,
            });
        } catch (error) {
            const isAbort = error?.name === 'AbortError';
            throw this.#error(
                bodyKind,
                isAbort ? 'download_timeout' : 'download_failed',
                isAbort ? `${bodyKind.label} download timed out.` : `${bodyKind.label} download failed.`,
                { nonRetryable: false }
            );
        }
    }

    async #readBodyWithLimits(response, signal, bodyKind) {
        if (typeof response.body?.getReader === 'function') {
            return this.#readStreamWithLimits(response.body.getReader(), signal, bodyKind);
        }

        if (typeof response.arrayBuffer !== 'function') {
            throw this.#error(bodyKind, 'download_failed', `${bodyKind.label} response cannot be read.`, {
                nonRetryable: false,
            });
        }

        try {
            const arrayBuffer = await this.#withAbort(response.arrayBuffer(), signal, bodyKind);
            const buffer = Buffer.from(arrayBuffer);
            this.#assertAllowedBufferLength(buffer, bodyKind);
            return buffer;
        } catch (error) {
            if (error instanceof ChannelHubInboundTextBodyDownloadError) {
                throw error;
            }

            const isAbort = error?.name === 'AbortError';
            throw this.#error(
                bodyKind,
                isAbort ? 'download_timeout' : 'download_failed',
                isAbort ? `${bodyKind.label} download timed out.` : `${bodyKind.label} download failed.`,
                { nonRetryable: false }
            );
        }
    }

    async #readStreamWithLimits(reader, signal, bodyKind) {
        const chunks = [];
        let bytesRead = 0;

        try {
            while (true) {
                const { done, value } = await this.#withAbort(reader.read(), signal, bodyKind);
                if (done) {
                    return Buffer.concat(chunks, bytesRead);
                }

                const chunk = Buffer.from(value);
                if (bytesRead + chunk.length > this.#maxBytes) {
                    await reader.cancel?.();
                    throw this.#tooLargeError(bodyKind, bytesRead + chunk.length);
                }

                chunks.push(chunk);
                bytesRead += chunk.length;
            }
        } catch (error) {
            if (error instanceof ChannelHubInboundTextBodyDownloadError) {
                throw error;
            }

            const isAbort = error?.name === 'AbortError';
            throw this.#error(
                bodyKind,
                isAbort ? 'download_timeout' : 'download_failed',
                isAbort ? `${bodyKind.label} download timed out.` : `${bodyKind.label} download failed.`,
                { nonRetryable: false }
            );
        } finally {
            reader.releaseLock?.();
        }
    }

    #withAbort(promise, signal, bodyKind) {
        if (signal.aborted) {
            return Promise.reject(this.#timeoutError(bodyKind));
        }

        return new Promise((resolve, reject) => {
            const onAbort = () => reject(this.#timeoutError(bodyKind));
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

    #timeoutError(bodyKind) {
        return this.#error(bodyKind, 'download_timeout', `${bodyKind.label} download timed out.`, {
            nonRetryable: false,
        });
    }

    #isRedirect(response) {
        return response.status >= 300 && response.status < 400;
    }

    #assertAllowedContentLength(response, bodyKind) {
        const contentLength = Number(response.headers?.get?.('content-length'));
        if (Number.isFinite(contentLength) && contentLength > this.#maxBytes) {
            throw this.#tooLargeError(bodyKind, contentLength);
        }
    }

    #assertAllowedBufferLength(buffer, bodyKind) {
        if (buffer.length > this.#maxBytes) {
            throw this.#tooLargeError(bodyKind, buffer.length);
        }
    }

    #tooLargeError(bodyKind, receivedBytes) {
        return this.#error(
            bodyKind,
            'too_large',
            `${bodyKind.label} exceeds ${this.#maxBytes} bytes (received ${receivedBytes})`
        );
    }

    #bodyKind(kind) {
        const normalized = kind === 'html' ? 'html' : 'text';
        return {
            name: normalized,
            label: BODY_KIND_LABELS[normalized],
            codePrefix: `${normalized}_body`,
        };
    }

    #error(bodyKind, reason, message, options) {
        const codes = {
            missing_url: `missing_${bodyKind.codePrefix}_url`,
            download_unavailable: `${bodyKind.codePrefix}_download_unavailable`,
            invalid_redirect: `invalid_${bodyKind.codePrefix}_redirect`,
            download_failed: `${bodyKind.codePrefix}_download_failed`,
            untrusted_url: `untrusted_${bodyKind.codePrefix}_url`,
            too_many_redirects: `too_many_${bodyKind.codePrefix}_redirects`,
            download_timeout: `${bodyKind.codePrefix}_download_timeout`,
            too_large: `${bodyKind.codePrefix}_too_large`,
        };

        return new ChannelHubInboundTextBodyDownloadError(codes[reason], message, options);
    }
}
