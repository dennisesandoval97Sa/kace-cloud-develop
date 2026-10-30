/**
 * DOMPurify whitelist for rich-text bodies edited with the Lexical `RichEditor`
 * (Templates, Cases admin comments, Helps descriptions). Mirrors the backend
 * whitelist in `packages/kace_cloud_core/src/shared/domain/security/HtmlTemplateSanitizer.js` —
 * keep both in sync when the allowed surface changes. The backend sanitizer is the
 * authoritative one (it runs on every save regardless of client); this config only
 * keeps the editor's own preview/output free of stripped-at-save-time markup.
 */
export const TEMPLATE_HTML_SANITIZE_CONFIG = {
    ALLOWED_TAGS: [
        "html",
        "head",
        "body",
        "title",
        "meta",
        "p",
        "br",
        "span",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "blockquote",
        "ul",
        "ol",
        "li",
        "hr",
        "table",
        "colgroup",
        "col",
        "thead",
        "tbody",
        "tfoot",
        "tr",
        "td",
        "th",
        "img",
        "a",
    ],
    ALLOWED_ATTR: [
        "class",
        "style",
        "dir",
        "align",
        "width",
        "height",
        "border",
        "cellpadding",
        "cellspacing",
        "colspan",
        "rowspan",
        "src",
        "alt",
        "data-filename",
        "data-mime",
        "href",
        "target",
        "rel",
        "charset",
    ],
    /*
     * `blob:` is allowed here (editor-preview-only whitelist) so the local object-URL
     * preview of an image inserted before a template exists (no id yet to upload
     * against) survives DOMPurify while the user is composing. It is never persisted:
     * TemplatesUpdateHandler swaps it for a real `template-attachment://` reference
     * once the template is created, and the backend's HtmlTemplateSanitizer (the
     * authoritative one, see file docstring) does not allow `blob:` at all — a body
     * saved with a stray blob: src is stripped there, not stored.
     */
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data|blob|template-attachment):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
};
