import { jest } from '@jest/globals';
import {
    TemplateAttachmentInlineImageEmbedder,
    TEMPLATE_IMAGE_INLINE_MAX_BYTES_TOTAL,
} from '../../../src/template-attachments/application/TemplateAttachmentInlineImageEmbedder.js';

describe('TemplateAttachmentInlineImageEmbedder', () => {
    it('exports the documented aggregate budget constant', () => {
        expect(TEMPLATE_IMAGE_INLINE_MAX_BYTES_TOTAL).toBe(400 * 1024);
    });

    it('replaces a template-attachment placeholder with a base64 data URI', async () => {
        const reader = {
            read: jest.fn(async ({ templateId, filename }) => ({
                filename,
                contentType: 'image/png',
                content: Buffer.from(`bytes-of-${templateId}-${filename}`),
            })),
        };
        const embedder = new TemplateAttachmentInlineImageEmbedder({ reader });

        const html =
            '<p>Hola</p><img src="template-attachment://tmpl-1" data-filename="logo.png" data-mime="image/png">';

        const result = await embedder.execute(html, { templateId: 'tmpl-1' });

        expect(reader.read).toHaveBeenCalledWith({
            templateId: 'tmpl-1',
            filename: 'logo.png',
            contentType: 'image/png',
        });
        const expectedDataUri = `data:image/png;base64,${Buffer.from('bytes-of-tmpl-1-logo.png').toString('base64')}`;
        expect(result).toBe(`<p>Hola</p><img src="${expectedDataUri}" data-filename="logo.png" data-mime="image/png">`);
    });

    it('leaves non-placeholder images untouched', async () => {
        const reader = { read: jest.fn() };
        const embedder = new TemplateAttachmentInlineImageEmbedder({ reader });
        const html = '<img src="https://bucket.s3.amazonaws.com/logo.png">';

        const result = await embedder.execute(html, { templateId: 'tmpl-1' });

        expect(result).toBe(html);
        expect(reader.read).not.toHaveBeenCalled();
    });

    it('drops the tag entirely when the S3 read fails, instead of leaving an unresolvable placeholder', async () => {
        const reader = {
            read: jest.fn(async () => {
                throw new Error('not_found');
            }),
        };
        const embedder = new TemplateAttachmentInlineImageEmbedder({ reader });
        const html = '<p>Antes</p><img src="template-attachment://tmpl-1" data-filename="missing.png"><p>Despues</p>';

        const result = await embedder.execute(html, { templateId: 'tmpl-1' });

        expect(result).toBe('<p>Antes</p><p>Despues</p>');
    });

    it('drops the tag when templateId is missing from the call context', async () => {
        const reader = { read: jest.fn() };
        const embedder = new TemplateAttachmentInlineImageEmbedder({ reader });
        const html = '<img src="template-attachment://tmpl-1" data-filename="logo.png">';

        const result = await embedder.execute(html, {});

        expect(result).toBe('');
        expect(reader.read).not.toHaveBeenCalled();
    });

    it('respects the aggregate byte budget across multiple images, dropping images once exhausted', async () => {
        const reader = {
            read: jest
                .fn()
                .mockResolvedValueOnce({ contentType: 'image/png', content: Buffer.alloc(10) })
                .mockResolvedValueOnce({ contentType: 'image/png', content: Buffer.alloc(10) }),
        };
        const embedder = new TemplateAttachmentInlineImageEmbedder({ reader, maxBytesTotal: 15 });
        const html =
            '<img src="template-attachment://tmpl-1" data-filename="a.png" data-mime="image/png">' +
            '<img src="template-attachment://tmpl-1" data-filename="b.png" data-mime="image/png">';

        const result = await embedder.execute(html, { templateId: 'tmpl-1' });

        // First image (10 bytes) fits within the 15-byte budget and gets embedded; the second
        // also gets read (remaining budget was still > 0 before the download), but since 10 bytes
        // would push the total to 20 > 15, it's dropped rather than embedded over-budget.
        expect(result).toContain('data:image/png;base64,');
        expect(result.match(/<img/g)).toHaveLength(1);
        expect(reader.read).toHaveBeenCalledTimes(2);
    });

    it('returns the input unchanged for null/undefined bodies', async () => {
        const embedder = new TemplateAttachmentInlineImageEmbedder({ reader: { read: jest.fn() } });

        expect(await embedder.execute(null, { templateId: 'tmpl-1' })).toBeNull();
        expect(await embedder.execute(undefined, { templateId: 'tmpl-1' })).toBeUndefined();
    });
});
