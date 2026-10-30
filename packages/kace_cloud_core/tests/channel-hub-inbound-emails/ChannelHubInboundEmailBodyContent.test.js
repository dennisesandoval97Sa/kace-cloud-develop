import {
    bodyBuffer,
    isHtmlContent,
    previewFromHtml,
    previewFromText,
    stripHtmlToText,
} from '../../src/channel-hub-inbound-emails/application/ChannelHubInboundEmailBodyContent.js';

describe('bodyBuffer', () => {
    it('unwraps an ArrayBuffer nested under a download object buffer property', () => {
        const arrayBuffer = new Uint8Array([104, 105]).buffer;

        const result = bodyBuffer({ buffer: arrayBuffer });

        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString('utf8')).toBe('hi');
    });

    it('unwraps a Uint8Array nested under a download object buffer property', () => {
        const typedArray = new Uint8Array([104, 105]);

        const result = bodyBuffer({ buffer: typedArray });

        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString('utf8')).toBe('hi');
    });

    it('falls back to the raw value itself when it has no buffer property', () => {
        const result = bodyBuffer('plain-text-value');

        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString('utf8')).toBe('plain-text-value');
    });

    it('returns an empty buffer for a nullish value instead of throwing', () => {
        const result = bodyBuffer(null);

        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.length).toBe(0);
    });
});

describe('stripHtmlToText', () => {
    it('strips tags, scripts, and decodes entities into plain text', () => {
        const html = '<article><h1>Hi &amp; welcome</h1><script>alert(1)</script><p>Line one</p></article>';

        const result = stripHtmlToText(html);

        expect(result).not.toContain('<');
        expect(result).not.toContain('alert(1)');
        expect(result).toContain('Hi & welcome');
        expect(result).toContain('Line one');
    });

    it('defaults to an empty string and returns an empty result when called without arguments', () => {
        const result = stripHtmlToText();

        expect(result).toBe('');
    });
});

describe('previewFromText', () => {
    it('truncates text longer than maxChars and marks it truncated', () => {
        const result = previewFromText('abcdefghij', 4);

        expect(result).toEqual({ preview: 'abcd', truncated: true });
    });

    it('does not mark text exactly at maxChars as truncated', () => {
        const result = previewFromText('abcd', 4);

        expect(result).toEqual({ preview: 'abcd', truncated: false });
    });

    it('does not mark short text as truncated', () => {
        const result = previewFromText('abc', 4);

        expect(result).toEqual({ preview: 'abc', truncated: false });
    });

    it('treats a null text as an empty string instead of throwing', () => {
        const result = previewFromText(null, 10);

        expect(result).toEqual({ preview: '', truncated: false });
    });

    it('defaults text and maxChars when called without arguments', () => {
        const result = previewFromText();

        expect(result).toEqual({ preview: '', truncated: false });
    });
});

describe('previewFromHtml', () => {
    it('strips HTML before building the preview', () => {
        const result = previewFromHtml('<p>Hello <b>world</b></p>', 50);

        expect(result.preview).toBe('Hello world');
        expect(result.truncated).toBe(false);
    });

    it('defaults html and maxChars when called without arguments', () => {
        const result = previewFromHtml();

        expect(result).toEqual({ preview: '', truncated: false });
    });
});

describe('isHtmlContent', () => {
    it('detects HTML from the content type header', () => {
        expect(isHtmlContent({ contentType: 'text/html; charset=utf-8', body: '', url: '' })).toBe(true);
    });

    it('detects HTML from a .html URL when the content type is not conclusive', () => {
        expect(
            isHtmlContent({ contentType: 'application/octet-stream', body: 'plain', url: 'https://x.test/msg.html' })
        ).toBe(true);
    });

    it('detects HTML from body markup when neither content type nor URL are conclusive', () => {
        expect(isHtmlContent({ contentType: '', body: '<article>hi</article>', url: 'https://x.test/msg' })).toBe(true);
    });

    it('returns false for plain text with no HTML signal', () => {
        expect(isHtmlContent({ contentType: 'text/plain', body: 'hello', url: 'https://x.test/msg.txt' })).toBe(false);
    });

    it('returns false and defaults every field when called without arguments', () => {
        expect(isHtmlContent()).toBe(false);
    });
});
