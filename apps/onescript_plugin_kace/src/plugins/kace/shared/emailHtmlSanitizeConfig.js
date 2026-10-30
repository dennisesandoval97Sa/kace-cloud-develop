import DOMPurify from 'dompurify';

/**
 * Shared DOMPurify config + hooks for all HTML rendered inside the email
 * form. Consumed by exactly two call sites today, with different trust
 * levels for the HTML they pass in:
 *
 *  - useEmailForm.js (handleTemplateChange): renders an org-authored email
 *    TEMPLATE body. Semi-trusted — only agents/admins with template-edit
 *    permissions can shape this HTML.
 *  - useReceivedEmail.js (load): renders the body of an EXTERNAL, INBOUND
 *    email from an arbitrary sender via dangerouslySetInnerHTML. Untrusted —
 *    this is the attacker-controlled path (see the href/data: and style
 *    hardening below).
 *
 * The href/data: block, style hardening and rel=noopener hooks below apply
 * to both (DOMPurify hooks are global to the shared instance). On top of
 * that, RECEIVED_EMAIL_HTML_SANITIZE_CONFIG forbids `style` outright for the
 * untrusted path — inline CSS from an external sender is purely decorative,
 * so dropping it removes the whole style-based attack surface with no loss
 * of text/links/images/table structure. Templates keep `style` since it
 * carries org branding and is authored by trusted staff.
 */
const UNSAFE_STYLE_RE =
  /url\s*\(\s*['"]?(?!https?:)[^'")]*['"]?\s*\)|expression\s*\([^)]*\)|-moz-binding\s*:[^;]*|behavior\s*:[^;]*|@import[^;]*|javascript\s*:/gi;

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'href' && /^data:/i.test(data.attrValue)) {
    data.keepAttr = false;
    return;
  }
  if (data.attrName === 'style') {
    data.attrValue = data.attrValue.replace(UNSAFE_STYLE_RE, '');
  }
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('target')) {
    node.setAttribute('rel', 'noopener noreferrer nofollow');
  }
});

export const EMAIL_HTML_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
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
  ],
  ALLOWED_ATTR: [
    'class',
    'style',
    'dir',
    'align',
    'width',
    'height',
    'border',
    'cellpadding',
    'cellspacing',
    'colspan',
    'rowspan',
    'src',
    'alt',
    'href',
    'target',
    'rel',
  ],
  ALLOWED_URI_REGEXP: /^(?:https?|data):/i,
  // DOMPurify runs ALLOWED_URI_REGEXP against the VALUE of every attribute
  // that isn't in its own inert-attribute allowlist (class/style/alt/... —
  // not href/src) — not just conventionally URI-shaped ones. Without this,
  // non-URI values like target="_blank", width="600" or colspan="2" fail
  // that regex and get silently dropped.
  ADD_URI_SAFE_ATTR: [
    'dir',
    'align',
    'width',
    'height',
    'border',
    'cellpadding',
    'cellspacing',
    'colspan',
    'rowspan',
    'target',
    'rel',
  ],
};

// Stricter variant for untrusted, externally-received email bodies: same
// allowlist as above but with `style` forbidden outright (see header doc).
export const RECEIVED_EMAIL_HTML_SANITIZE_CONFIG = {
  ...EMAIL_HTML_SANITIZE_CONFIG,
  FORBID_ATTR: ['style'],
};
