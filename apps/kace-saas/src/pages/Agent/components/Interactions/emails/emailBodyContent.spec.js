import { describe, expect, it } from "vitest";
import { escapeHtml, getEmailBodyContent } from "./emailBodyContent";

const inlineDefaults = {
    bodyUrl: null,
    isExternal: false,
    previewTruncated: false,
    contentType: null,
    mode: "inline",
};

describe("emailBodyContent", () => {
    it("normalizes the new Email detail body object as inline content", () => {
        expect(
            getEmailBodyContent({
                body: {
                    body: "Plain text",
                    body_html: "<p>HTML text</p>",
                },
            }),
        ).toEqual({
            plain: "Plain text",
            html: "<p>HTML text</p>",
            preferredPart: "html",
            ...inlineDefaults,
        });
    });

    it("normalizes a legacy string body as inline plain text", () => {
        expect(getEmailBodyContent({ body: "Legacy plain text" })).toEqual({
            plain: "Legacy plain text",
            html: "",
            preferredPart: "text",
            ...inlineDefaults,
        });
    });

    it("normalizes an external HTML body metadata shape with preview text", () => {
        expect(
            getEmailBodyContent({
                body: {
                    body: "Large body preview",
                    body_html: null,
                    text: {
                        mode: "inline",
                        preview_truncated: false,
                    },
                    html: {
                        mode: "external",
                        bodyUrl: "/emails/email-id/body?part=html",
                        content_type: "text/html; charset=utf-8",
                        preview_truncated: true,
                    },
                },
            }),
        ).toEqual({
            plain: "Large body preview",
            html: "",
            preferredPart: "html",
            bodyUrl: "/emails/email-id/body?part=html",
            isExternal: true,
            previewTruncated: true,
            contentType: "text/html; charset=utf-8",
            mode: "external",
        });
    });

    it("uses the external text body metadata when external HTML is missing", () => {
        expect(
            getEmailBodyContent({
                body: {
                    body: "Text body preview",
                    body_html: null,
                    text: {
                        mode: "external",
                        body_url: "/emails/email-id/body?part=text",
                        contentType: "text/plain; charset=utf-8",
                        previewTruncated: true,
                    },
                },
            }),
        ).toEqual({
            plain: "Text body preview",
            html: "",
            preferredPart: "text",
            bodyUrl: "/emails/email-id/body?part=text",
            isExternal: true,
            previewTruncated: true,
            contentType: "text/plain; charset=utf-8",
            mode: "external",
        });
    });

    it("keeps preferring inline HTML over external text metadata", () => {
        expect(
            getEmailBodyContent({
                body: {
                    body: "Text body preview",
                    body_html: "<p>Inline HTML body</p>",
                    text: {
                        mode: "external",
                        bodyUrl: "/emails/email-id/body?part=text",
                        previewTruncated: true,
                    },
                    html: {
                        mode: "inline",
                        content_type: "text/html; charset=utf-8",
                    },
                },
            }),
        ).toEqual({
            plain: "Text body preview",
            html: "<p>Inline HTML body</p>",
            preferredPart: "html",
            bodyUrl: null,
            isExternal: false,
            previewTruncated: false,
            contentType: "text/html; charset=utf-8",
            mode: "inline",
        });
    });

    it("escapes plain text for print fallback", () => {
        expect(escapeHtml('<script>alert("x")</script> & text')).toBe(
            "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; text",
        );
    });
});
