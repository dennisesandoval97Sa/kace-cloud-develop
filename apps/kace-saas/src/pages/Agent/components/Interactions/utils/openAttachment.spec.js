import { afterEach, describe, expect, it, vi } from "vitest";

const sendInformation = vi.hoisted(() => vi.fn());

vi.mock("@/services/generic-send-information", () => ({
    sendInformation,
}));

describe("openAttachment", () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("opens a /download-s3-files signed URL in a new tab instead of the raw S3 url", async () => {
        const { openAttachment } = await import("./openAttachment");
        const signedUrl = "https://signed.example/attachments/email-id/invoice.pdf?X-Amz-Signature=ok";
        const open = vi.fn();
        sendInformation.mockResolvedValue({ data: { data: { uploadUrl: signedUrl } } });
        vi.stubGlobal("open", open);

        await openAttachment({
            filename: "invoice.pdf",
            url: "https://bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf",
            contentType: "application/pdf",
        });

        expect(sendInformation).toHaveBeenCalledWith({
            url: "/download-s3-files",
            dataPost: {
                url: "attachments",
                id: "email-id",
                fileName: "invoice.pdf",
                contentType: "application/pdf",
            },
        });
        expect(open).toHaveBeenCalledWith(signedUrl, "_blank", "noopener,noreferrer");
    });

    it("throws without opening a tab when /download-s3-files does not return a signed URL", async () => {
        const { openAttachment } = await import("./openAttachment");
        const open = vi.fn();
        vi.stubGlobal("open", open);
        sendInformation.mockResolvedValue({ data: { data: {} } });

        await expect(
            openAttachment({
                filename: "invoice.pdf",
                url: "https://bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf",
            }),
        ).rejects.toThrow("missing_attachment_download_url");

        expect(open).not.toHaveBeenCalled();
    });
});
