import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTemplateAttachmentPlaceholders } from './templateAttachmentImageResolver.js';

describe('resolveTemplateAttachmentPlaceholders', () => {
  let apiService;

  beforeEach(() => {
    apiService = { post: vi.fn() };
  });

  it('returns the html unchanged when there are no template-attachment images', async () => {
    const html = '<p>Hello</p><img src="https://cdn.example.com/logo.png">';
    const out = await resolveTemplateAttachmentPlaceholders(html, apiService);
    expect(out).toBe(html);
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('replaces the src with the presigned download URL', async () => {
    apiService.post.mockResolvedValue({
      data: { data: { uploadUrl: 'https://s3.example.com/signed' } },
    });

    const html =
      '<img src="template-attachment://tpl-1" data-filename="logo.png" data-mime="image/png">';
    const out = await resolveTemplateAttachmentPlaceholders(html, apiService);

    expect(out).toContain('src="https://s3.example.com/signed"');
    expect(apiService.post).toHaveBeenCalledWith('/download-s3-files', {
      id: 'tpl-1',
      contentType: 'image/png',
      fileName: 'logo.png',
      url: 'template',
    });
  });

  it('leaves the tag untouched when data-filename is missing', async () => {
    const html = '<img src="template-attachment://tpl-1">';
    const out = await resolveTemplateAttachmentPlaceholders(html, apiService);
    expect(out).toBe(html);
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('leaves the tag untouched when the response has no uploadUrl', async () => {
    apiService.post.mockResolvedValue({ data: { data: {} } });
    const html =
      '<img src="template-attachment://tpl-1" data-filename="logo.png">';
    const out = await resolveTemplateAttachmentPlaceholders(html, apiService);
    expect(out).toBe(html);
  });

  it('leaves the tag untouched and warns when the request fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    apiService.post.mockRejectedValue({ response: { status: 404 } });

    const html =
      '<img src="template-attachment://tpl-1" data-filename="logo.png">';
    const out = await resolveTemplateAttachmentPlaceholders(html, apiService);

    expect(out).toBe(html);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('resolveTemplateAttachmentPlaceholders'),
      expect.objectContaining({
        templateId: 'tpl-1',
        filename: 'logo.png',
        status: 404,
      })
    );
    warnSpy.mockRestore();
  });

  it('resolves multiple placeholders independently', async () => {
    apiService.post.mockImplementation((_path, body) =>
      Promise.resolve({
        data: {
          data: { uploadUrl: `https://s3.example.com/${body.fileName}` },
        },
      })
    );

    const html =
      '<img src="template-attachment://a" data-filename="a.png">' +
      '<p>text</p>' +
      '<img src="template-attachment://b" data-filename="b.png">';

    const out = await resolveTemplateAttachmentPlaceholders(html, apiService);

    expect(out).toContain('src="https://s3.example.com/a.png"');
    expect(out).toContain('src="https://s3.example.com/b.png"');
    expect(apiService.post).toHaveBeenCalledTimes(2);
  });

  it('ignores <img> tags that are not template-attachment placeholders', async () => {
    const html = '<img src="https://cdn.example.com/photo.png" alt="x">';
    const out = await resolveTemplateAttachmentPlaceholders(html, apiService);
    expect(out).toBe(html);
    expect(apiService.post).not.toHaveBeenCalled();
  });
});
