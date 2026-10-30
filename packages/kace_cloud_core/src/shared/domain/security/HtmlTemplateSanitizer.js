import sanitizeHtml from 'sanitize-html';

/**
 * Structural HTML whitelist for email/document template bodies (Templates module).
 * Mirrors the frontend config in `apps/kace-saas/src/utils/templateHtmlSanitizeConfig.js` —
 * keep both in sync when the allowed surface changes.
 *
 * Block-level `<style>` is intentionally excluded: many webmail clients strip it anyway,
 * and inline `style` attributes (still allowed below) cover the same need with less risk.
 */
export class HtmlTemplateSanitizer {
    static ALLOWED_TAGS = [
        'html',
        'head',
        'body',
        'title',
        'meta',
        'p',
        'br',
        'span',
        'div',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'blockquote',
        'ul',
        'ol',
        'li',
        'hr',
        'table',
        'colgroup',
        'col',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'td',
        'th',
        'img',
        'a',
    ];

    static GLOBAL_ATTRIBUTES = ['class', 'style', 'dir', 'align', 'width', 'height'];

    static ALLOWED_ATTRIBUTES = {
        meta: ['charset'],
        table: [...HtmlTemplateSanitizer.GLOBAL_ATTRIBUTES, 'border', 'cellpadding', 'cellspacing'],
        td: [...HtmlTemplateSanitizer.GLOBAL_ATTRIBUTES, 'colspan', 'rowspan'],
        th: [...HtmlTemplateSanitizer.GLOBAL_ATTRIBUTES, 'colspan', 'rowspan'],
        img: [...HtmlTemplateSanitizer.GLOBAL_ATTRIBUTES, 'src', 'alt', 'data-filename', 'data-mime'],
        a: [...HtmlTemplateSanitizer.GLOBAL_ATTRIBUTES, 'href', 'target', 'rel'],
        '*': HtmlTemplateSanitizer.GLOBAL_ATTRIBUTES,
    };

    static ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'data', 'template-attachment'];

    /**
     * Sanitizes untrusted HTML, silently stripping disallowed tags/attributes rather than
     * rejecting the input — existing templates persisted before this sanitizer keep working
     * unchanged, and templates containing dangerous markup are cleaned instead of blocked.
     *
     * @param {string} html
     * @returns {string}
     */
    static sanitize(html) {
        if (typeof html !== 'string' || html.length === 0) {
            return html;
        }

        return sanitizeHtml(html, {
            allowedTags: HtmlTemplateSanitizer.ALLOWED_TAGS,
            allowedAttributes: HtmlTemplateSanitizer.ALLOWED_ATTRIBUTES,
            allowedSchemes: HtmlTemplateSanitizer.ALLOWED_SCHEMES,
            allowedSchemesByTag: {
                img: ['http', 'https', 'data', 'template-attachment'],
                a: ['http', 'https', 'mailto'],
            },
            allowProtocolRelative: false,
            enforceHtmlBoundary: false,
            disallowedTagsMode: 'discard',
            transformTags: {
                a: (tagName, attribs) =>
                    attribs.target === '_blank'
                        ? { tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }
                        : { tagName, attribs },
            },
        });
    }
}
