import { jest } from '@jest/globals';
import {
    ALLOWED_INLINE_IMAGE_MIME_TYPES,
    ChannelHubInlineImageEmbedder,
    MAX_INLINE_IMAGE_BYTES_TOTAL,
} from '../../src/channel-hub-inbound-emails/application/ChannelHubInlineImageEmbedder.js';
import { ChannelHubInboundAttachmentDownloader } from '../../src/channel-hub-inbound-emails/application/ChannelHubInboundAttachmentDownloader.js';

describe('ChannelHubInlineImageEmbedder', () => {
    it('embeds an eligible PNG image as a base64 data URI', async () => {
        const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        const downloader = {
            download: jest.fn().mockResolvedValue({
                buffer: pngBytes,
                contentType: 'image/png; charset=binary',
            }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });

        const html = '<p>Hello</p><img alt="logo" src="https://cdn.example.com/logo.png">';

        const result = await embedder.execute(html);

        expect(result).toBe(`<p>Hello</p><img alt="logo" src="data:image/png;base64,${pngBytes.toString('base64')}">`);
        expect(downloader.download).toHaveBeenCalledWith('https://cdn.example.com/logo.png', {
            maxBytes: MAX_INLINE_IMAGE_BYTES_TOTAL,
        });
    });

    it('decodes HTML attribute entities before downloading and replaces the original src text', async () => {
        const pngBytes = Buffer.from('image');
        const downloader = {
            download: jest.fn().mockResolvedValue({
                buffer: pngBytes,
                contentType: 'image/png',
            }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const encodedUrl =
            'https://cdn.example.com/logo.png?X-Amz-Credential=abc&amp;X-Amz-Signature=def&amp;response-content-disposition=inline';
        const decodedUrl =
            'https://cdn.example.com/logo.png?X-Amz-Credential=abc&X-Amz-Signature=def&response-content-disposition=inline';
        const html = `<img src="${encodedUrl}" alt="logo">`;

        const result = await embedder.execute(html);

        expect(downloader.download).toHaveBeenCalledWith(decodedUrl, {
            maxBytes: MAX_INLINE_IMAGE_BYTES_TOTAL,
        });
        expect(result).toBe(`<img src="data:image/png;base64,${pngBytes.toString('base64')}" alt="logo">`);
    });

    it('leaves existing data and cid sources unchanged without downloading', async () => {
        const downloader = {
            download: jest.fn(),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = '<img src="data:image/png;base64,abc"><img src=\'cid:inline-logo\'>';

        const result = await embedder.execute(html);

        expect(result).toBe(html);
        expect(downloader.download).not.toHaveBeenCalled();
    });

    it('leaves non-image content type unchanged', async () => {
        const downloader = {
            download: jest.fn().mockResolvedValue({
                buffer: Buffer.from('<svg></svg>'),
                contentType: 'text/html',
            }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = '<img src="https://cdn.example.com/not-an-image">';

        const result = await embedder.execute(html);

        expect(result).toBe(html);
        expect(downloader.download).toHaveBeenCalledWith('https://cdn.example.com/not-an-image', {
            maxBytes: MAX_INLINE_IMAGE_BYTES_TOTAL,
        });
    });

    it('respects the total original binary budget and continues with later images', async () => {
        const allowedBytes = Buffer.alloc(MAX_INLINE_IMAGE_BYTES_TOTAL - 1, 1);
        const oversizedBytes = Buffer.from([2, 3]);
        const remainingByte = Buffer.from([4]);
        const downloader = {
            download: jest
                .fn()
                .mockResolvedValueOnce({ buffer: allowedBytes, contentType: 'image/jpeg' })
                .mockResolvedValueOnce({ buffer: oversizedBytes, contentType: 'image/gif' })
                .mockResolvedValueOnce({ buffer: remainingByte, contentType: 'image/webp' }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = [
            '<img src="https://cdn.example.com/first.jpg">',
            '<img src="https://cdn.example.com/too-large.gif">',
            '<img src="https://cdn.example.com/fits.webp">',
        ].join('');

        const result = await embedder.execute(html);

        expect(result).toBe(
            [
                `<img src="data:image/jpeg;base64,${allowedBytes.toString('base64')}">`,
                '<img src="https://cdn.example.com/too-large.gif">',
                `<img src="data:image/webp;base64,${remainingByte.toString('base64')}">`,
            ].join('')
        );
        expect(downloader.download).toHaveBeenCalledTimes(3);
        expect(downloader.download).toHaveBeenNthCalledWith(1, 'https://cdn.example.com/first.jpg', {
            maxBytes: MAX_INLINE_IMAGE_BYTES_TOTAL,
        });
        expect(downloader.download).toHaveBeenNthCalledWith(2, 'https://cdn.example.com/too-large.gif', {
            maxBytes: 1,
        });
        expect(downloader.download).toHaveBeenNthCalledWith(3, 'https://cdn.example.com/fits.webp', {
            maxBytes: 1,
        });
    });

    it('stops downloading additional images once the total budget is exhausted', async () => {
        const fullBudgetBytes = Buffer.from([1, 2]);
        const downloader = {
            download: jest.fn().mockResolvedValue({
                buffer: fullBudgetBytes,
                contentType: 'image/png',
            }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader, maxBytesTotal: fullBudgetBytes.length });
        const html = '<img src="https://cdn.example.com/first.png"><img src="https://cdn.example.com/second.png">';

        const result = await embedder.execute(html);

        expect(result).toBe(
            `<img src="data:image/png;base64,${fullBudgetBytes.toString(
                'base64'
            )}"><img src="https://cdn.example.com/second.png">`
        );
        expect(downloader.download).toHaveBeenCalledTimes(1);
        expect(downloader.download).toHaveBeenCalledWith('https://cdn.example.com/first.png', {
            maxBytes: fullBudgetBytes.length,
        });
    });

    it('reuses downloaded image data for duplicate decoded URLs', async () => {
        const imageBytes = Buffer.from([1, 2]);
        const downloader = {
            download: jest.fn().mockResolvedValue({
                buffer: imageBytes,
                contentType: 'image/png',
            }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader, maxBytesTotal: imageBytes.length * 2 });
        const encodedUrl = 'https://cdn.example.com/logo.png?token=a&amp;signature=b';
        const decodedUrl = 'https://cdn.example.com/logo.png?token=a&signature=b';
        const expectedDataUri = `data:image/png;base64,${imageBytes.toString('base64')}`;
        const html = `<img src="${encodedUrl}"><img src="${encodedUrl}">`;

        const result = await embedder.execute(html);

        expect(result).toBe(`<img src="${expectedDataUri}"><img src="${expectedDataUri}">`);
        expect(downloader.download).toHaveBeenCalledTimes(1);
        expect(downloader.download).toHaveBeenCalledWith(decodedUrl, {
            maxBytes: imageBytes.length * 2,
        });
    });

    it('leaves URL unchanged when downloader rejects unsafe or redirected sources', async () => {
        const downloader = {
            download: jest.fn().mockRejectedValue(new Error('untrusted redirect target')),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = '<img src="https://cdn.example.com/redirects-away.png">';

        const result = await embedder.execute(html);

        expect(result).toBe(html);
        expect(downloader.download).toHaveBeenCalledWith('https://cdn.example.com/redirects-away.png', {
            maxBytes: MAX_INLINE_IMAGE_BYTES_TOTAL,
        });
    });

    it('exports the expected allowed MIME type set', () => {
        expect([...ALLOWED_INLINE_IMAGE_MIME_TYPES].sort()).toEqual([
            'image/gif',
            'image/jpeg',
            'image/png',
            'image/webp',
        ]);
    });

    it('returns null and undefined unchanged without touching the downloader', async () => {
        const downloader = { download: jest.fn() };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });

        await expect(embedder.execute(null)).resolves.toBeNull();
        await expect(embedder.execute(undefined)).resolves.toBeUndefined();
        expect(downloader.download).not.toHaveBeenCalled();
    });

    it('falls back to the default byte budget when constructed with no arguments at all', async () => {
        const embedder = new ChannelHubInlineImageEmbedder();
        const html = '<img src="https://cdn.example.com/logo.png">';

        const result = await embedder.execute(html);

        expect(result).toBe(html);
    });

    it('leaves the tag unchanged when the downloaded image has no content type', async () => {
        const downloader = {
            download: jest.fn().mockResolvedValue({
                buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
            }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = '<img src="https://cdn.example.com/logo.png">';

        const result = await embedder.execute(html);

        expect(result).toBe(html);
    });

    it('decodes decimal and hexadecimal numeric HTML entities in the src before downloading', async () => {
        const pngBytes = Buffer.from([1, 2, 3]);
        const downloader = {
            download: jest.fn().mockResolvedValue({ buffer: pngBytes, contentType: 'image/png' }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = '<img src="https://cdn.example.com/logo.png?a=1&#38;b=2&#x26;c=3">';

        await embedder.execute(html);

        expect(downloader.download).toHaveBeenCalledWith('https://cdn.example.com/logo.png?a=1&b=2&c=3', {
            maxBytes: MAX_INLINE_IMAGE_BYTES_TOTAL,
        });
    });

    it('leaves a numeric HTML entity unresolved when its code point exceeds the safe number range', async () => {
        const downloader = { download: jest.fn().mockResolvedValue({ buffer: Buffer.from([1]) }) };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const overflowingEntity = `&#${'9'.repeat(320)};`;
        const html = `<img src="https://cdn.example.com/logo.png?x=${overflowingEntity}">`;

        await embedder.execute(html);

        expect(downloader.download).toHaveBeenCalledWith(`https://cdn.example.com/logo.png?x=${overflowingEntity}`, {
            maxBytes: MAX_INLINE_IMAGE_BYTES_TOTAL,
        });
    });

    it('accepts a downloaded ArrayBuffer that is not wrapped in a typed array view', async () => {
        const pngBytes = new Uint8Array([9, 9, 9]);
        const downloader = {
            download: jest.fn().mockResolvedValue({ buffer: pngBytes.buffer, contentType: 'image/png' }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = '<img src="https://cdn.example.com/logo.png">';

        const result = await embedder.execute(html);

        expect(result).toBe(`<img src="data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}">`);
    });

    it('accepts a downloaded typed array view that is not a Node Buffer', async () => {
        const pngBytes = new Uint8Array([7, 7, 7]);
        const downloader = {
            download: jest.fn().mockResolvedValue({ buffer: pngBytes, contentType: 'image/png' }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = '<img src="https://cdn.example.com/logo.png">';

        const result = await embedder.execute(html);

        expect(result).toBe(`<img src="data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}">`);
    });

    it('falls back to treating an unexpected non-buffer download value as UTF-8 text bytes', async () => {
        const rawText = 'unexpected-download-shape';
        const downloader = {
            download: jest.fn().mockResolvedValue({ buffer: rawText, contentType: 'image/png' }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = '<img src="https://cdn.example.com/logo.png">';

        const result = await embedder.execute(html);

        expect(result).toBe(`<img src="data:image/png;base64,${Buffer.from(rawText, 'utf8').toString('base64')}">`);
    });

    it('embeds an empty data URI without throwing when the download has no buffer at all', async () => {
        // KACE-BUG: #bufferFrom() only guards against buffers that are TOO LARGE
        // (`buffer.length > remainingBytes`); it never checks for a missing/empty
        // buffer, so a downloader response with no `buffer` field silently rewrites
        // the <img> tag into a broken zero-byte `data:image/png;base64,` image
        // instead of leaving the original remote src (or the tag) untouched.
        const downloader = {
            download: jest.fn().mockResolvedValue({ contentType: 'image/png' }),
        };
        const embedder = new ChannelHubInlineImageEmbedder({ downloader });
        const html = '<img src="https://cdn.example.com/logo.png">';

        const result = await embedder.execute(html);

        expect(result).toBe('<img src="data:image/png;base64,">');
    });
});

describe('ChannelHubInboundAttachmentDownloader per-call maxBytes', () => {
    const allowedConnectionRepository = {
        isAllowedConnection: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
        allowedConnectionRepository.isAllowedConnection.mockClear();
    });

    it('honors per-call maxBytes from Content-Length before reading the body', async () => {
        const arrayBuffer = jest.fn();
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: jest.fn((name) => (name === 'content-length' ? '6' : null)),
            },
            arrayBuffer,
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository,
            maxBytes: 10,
        });

        await expect(downloader.download('https://cdn.example.com/image.png', { maxBytes: 5 })).rejects.toMatchObject({
            code: 'attachment_too_large',
            nonRetryable: true,
        });
        expect(arrayBuffer).not.toHaveBeenCalled();
    });

    it('uses the constructor maxBytes when no per-call maxBytes is provided', async () => {
        const bytes = Uint8Array.from([1, 2, 3, 4, 5, 6]);
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: jest.fn((name) => {
                    if (name === 'content-length') {
                        return '6';
                    }
                    if (name === 'content-type') {
                        return 'image/png';
                    }
                    return null;
                }),
            },
            arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository,
            maxBytes: 10,
        });

        const result = await downloader.download('https://cdn.example.com/image.png');

        expect(result.buffer).toEqual(Buffer.from(bytes));
        expect(result.contentLength).toBe(6);
    });

    it('uses the original filename suffix from long Channel Hub generated attachment URLs', async () => {
        const bytes = Uint8Array.from([1, 2, 3]);
        const longChannelHubPrefix =
            'ANGjdJ8M4TdFA665glbxBCQjcdmg16qzO9KSgYdJauknrw0zRKJaWdVXdXYYYRRcR5GPcue5lUFXEKqaSSPtZl'.repeat(2);
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: jest.fn((name) => {
                    if (name === 'content-type') {
                        return 'image/png';
                    }
                    return null;
                }),
            },
            arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository,
            maxBytes: 10,
        });

        const result = await downloader.download(
            `https://d13sfafwp8nvyq.cloudfront.net/attachments/19e4ce5cbf1b879d/${longChannelHubPrefix}_tmp2ur3f1a3.png?Expires=1779410196&Signature=abc`
        );

        expect(result.filename).toBe('tmp2ur3f1a3.png');
    });

    it('keeps normal underscored URL filenames unchanged', async () => {
        const bytes = Uint8Array.from([1, 2, 3]);
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: jest.fn((name) => {
                    if (name === 'content-type') {
                        return 'application/pdf';
                    }
                    return null;
                }),
            },
            arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository,
            maxBytes: 10,
        });

        const result = await downloader.download('https://cdn.example.com/customer_invoice_final.pdf');

        expect(result.filename).toBe('customer_invoice_final.pdf');
    });

    it('honors per-call maxBytes while streaming the body', async () => {
        const cancel = jest.fn();
        const read = jest
            .fn()
            .mockResolvedValueOnce({ done: false, value: Uint8Array.from([1, 2, 3]) })
            .mockResolvedValueOnce({ done: false, value: Uint8Array.from([4, 5, 6]) });
        const fetchFn = jest.fn().mockResolvedValue({
            status: 200,
            ok: true,
            headers: {
                get: jest.fn(() => null),
            },
            body: {
                getReader: () => ({ read, cancel }),
            },
        });
        const downloader = new ChannelHubInboundAttachmentDownloader({
            fetchFn,
            allowedConnectionRepository,
            maxBytes: 10,
        });

        await expect(downloader.download('https://cdn.example.com/image.png', { maxBytes: 5 })).rejects.toMatchObject({
            code: 'attachment_too_large',
            nonRetryable: true,
        });
        expect(read).toHaveBeenCalledTimes(2);
        expect(cancel).toHaveBeenCalledTimes(1);
    });
});
