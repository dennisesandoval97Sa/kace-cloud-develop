import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import {
  EMAIL_HTML_SANITIZE_CONFIG,
  RECEIVED_EMAIL_HTML_SANITIZE_CONFIG,
} from './emailHtmlSanitizeConfig.js';

const sanitize = (html, config = EMAIL_HTML_SANITIZE_CONFIG) =>
  DOMPurify.sanitize(html, config);

describe('EMAIL_HTML_SANITIZE_CONFIG', () => {
  it('strips data: hrefs from anchors (phishing/tabnabbing vector)', () => {
    const out = sanitize(
      '<a href="data:text/html,<script>alert(1)</script>">click</a>'
    );
    expect(out).not.toContain('data:');
    expect(out).not.toContain('<script>');
  });

  it('keeps https hrefs on anchors', () => {
    const out = sanitize('<a href="https://example.com">click</a>');
    expect(out).toContain('href="https://example.com"');
  });

  it('allows data: on inline <img src> (legitimate use case)', () => {
    const out = sanitize('<img src="data:image/png;base64,AAAA">');
    expect(out).toContain('src="data:image/png;base64,AAAA"');
  });

  it('forces rel="noopener noreferrer nofollow" on anchors with target', () => {
    const out = sanitize('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('does not add rel to anchors without target', () => {
    const out = sanitize('<a href="https://example.com">x</a>');
    expect(out).not.toContain('rel=');
  });

  it('keeps target itself (not just failing to add rel)', () => {
    // Regression: ALLOWED_URI_REGEXP is checked against the VALUE of every
    // attribute not in DOMPurify's own inert-attribute list, not just
    // conventionally URI-shaped ones — "_blank" doesn't match
    // /^(?:https?|data):/i, so target was silently dropped without
    // ADD_URI_SAFE_ATTR.
    const out = sanitize('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('target="_blank"');
  });

  it('keeps non-uri table formatting attributes (width/colspan/etc.)', () => {
    const out = sanitize(
      '<table width="600" border="1" cellpadding="2" cellspacing="0">' +
        '<tr><td colspan="2" rowspan="1" align="center" dir="ltr">x</td></tr></table>'
    );
    expect(out).toContain('width="600"');
    expect(out).toContain('border="1"');
    expect(out).toContain('cellpadding="2"');
    expect(out).toContain('cellspacing="0"');
    expect(out).toContain('colspan="2"');
    expect(out).toContain('rowspan="1"');
    expect(out).toContain('align="center"');
    expect(out).toContain('dir="ltr"');
  });

  it('strips data:/javascript: url() from style but keeps https:// url()', () => {
    const out = sanitize(
      '<div style="background-image:url(data:image/png;base64,AAAA);color:red">x</div>'
    );
    expect(out).not.toContain('data:image');
    expect(out).toMatch(/color:\s*red/);

    const outHttps = sanitize(
      '<div style="background-image:url(https://cdn.example.com/logo.png)">x</div>'
    );
    expect(outHttps).toContain('https://cdn.example.com/logo.png');
  });

  it('strips protocol-relative url() from style (treated as untrusted)', () => {
    const out = sanitize(
      '<div style="background-image:url(//evil.com/x)">x</div>'
    );
    expect(out).not.toContain('evil.com');
  });

  it('strips expression()/behavior/-moz-binding/@import/javascript: from style', () => {
    const out = sanitize(
      '<div style="width:expression(alert(1));behavior:url(x.htc);-moz-binding:url(x.xml);color:blue">x</div>'
    );
    expect(out).not.toContain('expression(');
    expect(out).not.toContain('behavior:');
    expect(out).not.toContain('-moz-binding');
  });

  it('keeps style attribute allowed (template body is semi-trusted)', () => {
    const out = sanitize('<p style="color:red">hi</p>');
    expect(out).toContain('style=');
  });

  it('preserves html-entity-escaped tags as literal text instead of executing them', () => {
    const out = sanitize('see &lt;script&gt;alert(1)&lt;/script&gt; in docs');
    expect(out).toBe('see &lt;script&gt;alert(1)&lt;/script&gt; in docs');
  });
});

describe('RECEIVED_EMAIL_HTML_SANITIZE_CONFIG', () => {
  it('forbids style entirely for untrusted external email bodies', () => {
    const out = sanitize(
      '<p style="color:red">hi</p>',
      RECEIVED_EMAIL_HTML_SANITIZE_CONFIG
    );
    expect(out).not.toContain('style=');
    expect(out).toContain('hi');
  });

  it('still blocks data: hrefs and forces rel like the base config', () => {
    const out = sanitize(
      '<a href="data:text/html,x" target="_blank">click</a>',
      RECEIVED_EMAIL_HTML_SANITIZE_CONFIG
    );
    expect(out).not.toContain('data:');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('still allows data: image sources', () => {
    const out = sanitize(
      '<img src="data:image/png;base64,AAAA">',
      RECEIVED_EMAIL_HTML_SANITIZE_CONFIG
    );
    expect(out).toContain('src="data:image/png;base64,AAAA"');
  });
});
