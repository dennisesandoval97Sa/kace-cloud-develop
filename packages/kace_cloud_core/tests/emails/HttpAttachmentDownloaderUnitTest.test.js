import { jest } from '@jest/globals';
import { HttpAttachmentDownloader } from '../../src/emails/infrastructure/persistence/HttpAttachmentDownloader.js';

function buildResponse({ ok = true, status = 200, statusText = 'OK', headers = {}, body = 'file-content' } = {}) {
    return {
        ok,
        status,
        statusText,
        headers: { get: jest.fn((name) => headers[name.toLowerCase()] ?? null) },
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from(body)),
    };
}

describe('HttpAttachmentDownloader', () => {
    const originalFetch = global.fetch;
    let downloader;

    beforeEach(() => {
        downloader = new HttpAttachmentDownloader();
        global.fetch = jest.fn();
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it('rejects when no url is provided', async () => {
        await expect(downloader.download(null)).rejects.toMatchObject({
            message: 'Attachment download URL is required',
            statusCode: 400,
        });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('wraps network failures as a 502 CustomError', async () => {
        global.fetch.mockRejectedValue(new Error('ECONNRESET'));

        await expect(downloader.download('https://example.com/file.pdf')).rejects.toMatchObject({
            message: 'Failed to download attachment. Network error while accessing URL: https://example.com/file.pdf',
            statusCode: 502,
        });
    });

    it('rejects non-ok HTTP responses as a 502 CustomError including status and statusText', async () => {
        global.fetch.mockResolvedValue(buildResponse({ ok: false, status: 404, statusText: 'Not Found' }));

        await expect(downloader.download('https://example.com/missing.pdf')).rejects.toMatchObject({
            message:
                'Failed to download attachment. HTTP status 404 (Not Found) for URL: https://example.com/missing.pdf',
            statusCode: 502,
        });
    });

    it('wraps failures while reading the response body as a 422 CustomError', async () => {
        const response = buildResponse();
        response.arrayBuffer.mockRejectedValue(new Error('stream aborted'));
        global.fetch.mockResolvedValue(response);

        await expect(downloader.download('https://example.com/broken.pdf')).rejects.toMatchObject({
            message: 'Failed to process attachment content from URL: https://example.com/broken.pdf',
            statusCode: 422,
        });
    });

    it('extracts the filename from Content-Disposition when present', async () => {
        global.fetch.mockResolvedValue(
            buildResponse({
                headers: {
                    'content-type': 'application/pdf',
                    'content-disposition': 'attachment; filename="report.pdf"',
                },
                body: 'pdf-bytes',
            })
        );

        const result = await downloader.download('https://example.com/download?id=1');

        expect(result).toEqual({
            buffer: Buffer.from('pdf-bytes'),
            contentType: 'application/pdf',
            filename: 'report.pdf',
        });
    });

    it('falls back to the URL path segment when Content-Disposition has no filename', async () => {
        global.fetch.mockResolvedValue(buildResponse({ headers: { 'content-disposition': 'inline' } }));

        const result = await downloader.download('https://example.com/uploads/invoice.png');

        expect(result.filename).toBe('invoice.png');
    });

    it('falls back to the URL path segment when Content-Disposition is absent entirely', async () => {
        global.fetch.mockResolvedValue(buildResponse());

        const result = await downloader.download('https://example.com/uploads/plain.txt');

        expect(result.filename).toBe('plain.txt');
        expect(result.contentType).toBeNull();
    });
});
