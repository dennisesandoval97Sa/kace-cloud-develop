import { HtmlTemplateSanitizer } from '../../../../src/shared/domain/security/HtmlTemplateSanitizer.js';

describe('HtmlTemplateSanitizer', () => {
    it('strips <script> tags and their content', () => {
        const dirty = '<p>Hola</p><script>alert(document.cookie)</script>';
        expect(HtmlTemplateSanitizer.sanitize(dirty)).toBe('<p>Hola</p>');
    });

    it('strips <iframe>, <object> and <embed> tags', () => {
        const dirty = '<iframe src="https://evil.test"></iframe><object data="x"></object><embed src="y">';
        expect(HtmlTemplateSanitizer.sanitize(dirty)).toBe('');
    });

    it('removes on* event handler attributes from any tag', () => {
        const dirty =
            '<p onclick="alert(1)" onmouseover="alert(2)">Hola</p><img src="https://a.test/x.png" onerror="alert(3)">';
        const clean = HtmlTemplateSanitizer.sanitize(dirty);
        expect(clean).not.toMatch(/on(click|mouseover|error)/);
        expect(clean).toContain('<p>Hola</p>');
    });

    it('strips javascript: URLs from href/src', () => {
        const dirty = '<a href="javascript:alert(1)">click</a>';
        const clean = HtmlTemplateSanitizer.sanitize(dirty);
        expect(clean).not.toContain('javascript:');
        expect(clean).not.toContain('href');
    });

    it('preserves allowed structural tags for a full HTML email template', () => {
        const dirty =
            '<html><head><title>t</title></head><body><h1>Title</h1><p>Text</p>' +
            '<table><tr><td>Cell</td></tr></table></body></html>';
        expect(HtmlTemplateSanitizer.sanitize(dirty)).toBe(dirty);
    });

    it('preserves template-attachment:// image placeholders with data-filename/data-mime', () => {
        const dirty = '<img src="template-attachment://logo.png" data-filename="logo.png" data-mime="image/png">';
        const clean = HtmlTemplateSanitizer.sanitize(dirty);
        expect(clean).toContain('src="template-attachment://logo.png"');
        expect(clean).toContain('data-filename="logo.png"');
        expect(clean).toContain('data-mime="image/png"');
    });

    it('preserves data: and https: image sources', () => {
        const dirty = '<img src="data:image/png;base64,aGVsbG8="><img src="https://a.test/x.png">';
        const clean = HtmlTemplateSanitizer.sanitize(dirty);
        expect(clean).toContain('src="data:image/png;base64,aGVsbG8="');
        expect(clean).toContain('src="https://a.test/x.png"');
    });

    it('drops block-level <style> tags', () => {
        const dirty = '<style>body { background: red }</style><p>Hola</p>';
        expect(HtmlTemplateSanitizer.sanitize(dirty)).toBe('<p>Hola</p>');
    });

    it('preserves inline style attributes', () => {
        const dirty = '<p style="color:red;">Hola</p>';
        expect(HtmlTemplateSanitizer.sanitize(dirty)).toBe('<p style="color:red">Hola</p>');
    });

    it('adds rel="noopener noreferrer" to target=_blank links', () => {
        const dirty = '<a href="https://a.test" target="_blank">link</a>';
        const clean = HtmlTemplateSanitizer.sanitize(dirty);
        expect(clean).toContain('rel="noopener noreferrer"');
    });

    it('returns non-string values untouched', () => {
        expect(HtmlTemplateSanitizer.sanitize(null)).toBeNull();
        expect(HtmlTemplateSanitizer.sanitize(undefined)).toBeUndefined();
        expect(HtmlTemplateSanitizer.sanitize('')).toBe('');
    });

    it('leaves plain text templates untouched (backward compatibility)', () => {
        const plain = 'Estimado cliente, su caso ha sido actualizado.';
        expect(HtmlTemplateSanitizer.sanitize(plain)).toBe(plain);
    });
});
