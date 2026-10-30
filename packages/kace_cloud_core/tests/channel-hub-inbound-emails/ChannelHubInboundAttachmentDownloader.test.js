import { jest } from '@jest/globals';
import { ChannelHubInboundAttachmentDownloader } from '../../src/channel-hub-inbound-emails/application/ChannelHubInboundAttachmentDownloader.js';

const url = 'https://cdn.example.com/attachments/invoice.pdf';

function headers(map = {}) {
    return { get: jest.fn((name) => map[name] ?? null) };
}

describe('ChannelHubInboundAttachmentDownloader', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('uses globalThis.fetch and skips the allowed-connection check when constructed with no arguments at all', async () => {
        const originalFetch = globalThis.fetch;
        const bytes = Uint8Array.from(Buffer.from('pdf-bytes'));
        const stubFetch = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers(),
            arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
        });
        globalThis.fetch = stubFetch;

        try {
            const downloader = new ChannelHubInboundAttachmentDownloader();

            const result = await downloader.download(url);

            // El objeto de opciones se afirma COMPLETO (sin objectContaining): `signal` es el
            // unico cableado que hace efectivo el timeout de descarga, y omitirlo dejaba pasar
            // la mutacion `signal: undefined`.
            expect(stubFetch).toHaveBeenCalledWith(url, {
                redirect: 'manual',
                signal: expect.any(AbortSignal),
            });
            expect(result.buffer.toString('utf8')).toBe('pdf-bytes');
            expect(result.contentType).toBeNull();
            expect(result.filename).toBe('invoice.pdf');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('rejects when the URL is missing', async () => {
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn: jest.fn(),
            allowedConnectionRepository: { isAllowedConnection: jest.fn() },
        });

        await expect(downloader.download('')).rejects.toMatchObject({
            nonRetryable: true,
            code: 'missing_attachment_url',
            message: 'Attachment URL is required.',
        });
    });

    it('rejects when the configured fetchFn is not callable', async () => {
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn: null,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_unavailable',
            message: 'Attachment downloader is not available.',
        });
    });

    it('follows a redirect with a Location header and downloads from the final URL', async () => {
        const redirectedUrl = 'https://cdn.example.com/attachments/redirected-invoice.pdf';
        const bytes = Uint8Array.from(Buffer.from('final-bytes'));
        const fetchFn = jest
            .fn()
            .mockResolvedValueOnce({
                status: 302,
                ok: false,
                headers: headers({ location: redirectedUrl }),
            })
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                headers: headers({ 'content-type': 'application/pdf' }),
                arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
            });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        const result = await downloader.download(url);

        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(fetchFn).toHaveBeenNthCalledWith(2, redirectedUrl, {
            redirect: 'manual',
            signal: expect.any(AbortSignal),
        });
        // El mismo AbortSignal debe viajar en TODOS los saltos: un timeout que se reiniciara
        // (o desapareciera) en el redirect dejaria la descarga sin tope real.
        expect(fetchFn.mock.calls[1][1].signal).toBe(fetchFn.mock.calls[0][1].signal);
        expect(result.finalUrl).toBe(redirectedUrl);
        expect(result.contentType).toBe('application/pdf');
        expect(result.buffer.toString('utf8')).toBe('final-bytes');
    });

    it('rejects when a redirect response has no Location header', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 302,
            ok: false,
            headers: headers(),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'invalid_attachment_redirect',
            message: 'Attachment redirect is missing a Location header.',
        });
    });

    it('rejects as retryable when the download responds with a non-redirect error status', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 404,
            ok: false,
            headers: headers(),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_failed',
            message: 'Attachment download failed with HTTP status 404.',
        });
    });

    it('rejects once the redirect limit is exceeded', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 302,
            ok: false,
            headers: headers({ location: url }),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            maxRedirects: 0,
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'too_many_attachment_redirects',
            message: 'Attachment download exceeded the redirect limit.',
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('rejects as untrusted when the allowed-connection repository refuses the URL', async () => {
        const fetchFn = jest.fn();
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(false) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'untrusted_attachment_url',
            message: 'Attachment URL host is not trusted.',
        });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects as retryable when the fetch call itself throws a non-abort error', async () => {
        const fetchFn = jest.fn().mockRejectedValue(new Error('network unreachable'));
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_failed',
            message: 'Attachment download failed.',
        });
    });

    it('reports a timeout when the fetch call itself rejects with an AbortError', async () => {
        const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
        const fetchFn = jest.fn().mockRejectedValue(abortError);
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_timeout',
            message: 'Attachment download timed out.',
        });
    });

    it('rejects as retryable when the response body cannot be read at all', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers(),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_failed',
            message: 'Attachment response cannot be read.',
        });
    });

    it('treats an already-elapsed timeout as immediately aborted once headers return', async () => {
        jest.useFakeTimers();
        const fetchFn = jest.fn(
            () =>
                new Promise((resolve) => {
                    setTimeout(
                        () =>
                            resolve({
                                status: 200,
                                ok: true,
                                headers: headers(),
                                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
                            }),
                        20
                    );
                })
        );
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            timeoutMs: 5,
        });

        const download = downloader.download(url).catch((error) => error);
        await jest.advanceTimersByTimeAsync(25);
        const outcome = await download;

        expect(outcome).toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_timeout',
            message: 'Attachment download timed out.',
        });
    });

    it('rejects as retryable when reading the array buffer throws a non-abort error', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers(),
            arrayBuffer: jest.fn().mockRejectedValue(new Error('stream broke')),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_failed',
            message: 'Attachment download failed.',
        });
    });

    it('reports a timeout when reading the array buffer rejects with an AbortError', async () => {
        const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers(),
            arrayBuffer: jest.fn().mockRejectedValue(abortError),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_timeout',
            message: 'Attachment download timed out.',
        });
    });

    it('rejects as non-retryable when the downloaded buffer exceeds the max size but Content-Length was absent', async () => {
        const arrayBuffer = new Uint8Array(10).buffer;
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers(),
            arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            maxBytes: 5,
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: true,
            code: 'attachment_too_large',
            message: 'Attachment exceeds 5 bytes.',
        });
    });

    it('assembles a streamed attachment across multiple chunks and returns it once the reader signals done', async () => {
        const cancel = jest.fn();
        const read = jest
            .fn()
            .mockResolvedValueOnce({ done: false, value: Uint8Array.from([104, 105]) })
            .mockResolvedValueOnce({ done: false, value: Uint8Array.from([33]) })
            .mockResolvedValueOnce({ done: true, value: undefined });
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers(),
            body: { getReader: () => ({ read, cancel, releaseLock: jest.fn() }) },
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        const result = await downloader.download(url);

        expect(result.buffer.toString('utf8')).toBe('hi!');
        expect(cancel).not.toHaveBeenCalled();
    });

    it('rejects as retryable when the stream reader throws a non-abort error', async () => {
        const read = jest.fn().mockRejectedValue(new Error('reader broke'));
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers(),
            body: { getReader: () => ({ read, releaseLock: jest.fn() }) },
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_failed',
            message: 'Attachment download failed.',
        });
    });

    it('reports a timeout when the stream reader rejects with an AbortError', async () => {
        const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
        const read = jest.fn().mockRejectedValue(abortError);
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers(),
            body: { getReader: () => ({ read, releaseLock: jest.fn() }) },
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        await expect(downloader.download(url)).rejects.toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_timeout',
            message: 'Attachment download timed out.',
        });
    });

    it('derives the filename from an RFC 5987 UTF-8 Content-Disposition header', async () => {
        const bytes = Uint8Array.from(Buffer.from('x'));
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers({ 'content-disposition': "attachment; filename*=UTF-8''invoice%20final.pdf" }),
            arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        const result = await downloader.download(url);

        expect(result.filename).toBe('invoice-final.pdf');
    });

    it('derives the filename from a plain Content-Disposition filename attribute', async () => {
        const bytes = Uint8Array.from(Buffer.from('x'));
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers({ 'content-disposition': 'attachment; filename="receipt.pdf"' }),
            arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        const result = await downloader.download(url);

        expect(result.filename).toBe('receipt.pdf');
    });

    it('falls back to the URL filename when Content-Disposition is present but has no filename attribute', async () => {
        const bytes = Uint8Array.from(Buffer.from('x'));
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers({ 'content-disposition': 'attachment; size=123' }),
            arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        const result = await downloader.download('https://cdn.example.com/files/report.csv');

        expect(result.filename).toBe('report.csv');
    });

    it('falls back to the default filename when neither Content-Disposition nor the URL yield one', async () => {
        const bytes = Uint8Array.from(Buffer.from('x'));
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: headers(),
            arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
        });

        const result = await downloader.download('https://cdn.example.com/');

        expect(result.filename).toBe('attachment');
    });

    it('aborta de verdad la peticion en vuelo cuando vence timeoutMs (cableado real del AbortSignal)', async () => {
        // Este test NO fabrica el AbortError: deja que el AbortController real de download()
        // dispare `controller.abort()` tras timeoutMs y comprueba que la senal que recibio
        // fetch es exactamente esa. Si `signal` no se propagara, el fetch jamas se enteraria
        // del vencimiento y la descarga quedaria colgada para siempre.
        jest.useFakeTimers();
        let capturedSignal;
        const fetchFn = jest.fn(
            (_requestedUrl, options) =>
                new Promise((_resolve, reject) => {
                    capturedSignal = options.signal;
                    options.signal.addEventListener('abort', () => {
                        reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
                    });
                })
        );
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository: { isAllowedConnection: jest.fn().mockResolvedValue(true) },
            timeoutMs: 10,
        });

        const download = downloader.download(url).catch((error) => error);
        await jest.advanceTimersByTimeAsync(11);
        const outcome = await download;

        expect(fetchFn).toHaveBeenCalledWith(url, { redirect: 'manual', signal: expect.any(AbortSignal) });
        expect(capturedSignal).toBeInstanceOf(AbortSignal);
        expect(capturedSignal.aborted).toBe(true);
        expect(outcome).toMatchObject({
            nonRetryable: false,
            code: 'attachment_download_timeout',
            message: 'Attachment download timed out.',
        });
    });
});
