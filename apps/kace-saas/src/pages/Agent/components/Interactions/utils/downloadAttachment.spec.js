import { afterEach, describe, expect, it, vi } from "vitest";

const sendInformation = vi.hoisted(() => vi.fn());

vi.mock("@/services/generic-send-information", () => ({
    sendInformation,
}));

// Preserve the real URL constructor (used by buildS3FileDownloadPayload) while
// stubbing the object-URL helpers consumed by the blob download.
const stubObjectUrlHelpers = () => {
    class URLStub extends URL {}
    URLStub.createObjectURL = vi.fn().mockReturnValue("blob:attachment");
    URLStub.revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", URLStub);
};

describe("downloadAttachment", () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        document.body.innerHTML = "";
    });

    it("downloads through a /download-s3-files signed URL instead of the raw S3 url", async () => {
        const { downloadAttachment } = await import("./downloadAttachment");
        const click = vi.fn();
        const link = document.createElement("a");
        vi.spyOn(link, "click").mockImplementation(click);
        vi.spyOn(document, "createElement").mockReturnValue(link);
        const signedUrl = "https://signed.example/attachments/email-id/invoice.pdf?X-Amz-Signature=ok";
        const fetchMock = vi.fn().mockResolvedValue({ blob: vi.fn().mockResolvedValue(new Blob(["x"])) });
        sendInformation.mockResolvedValue({ data: { data: { uploadUrl: signedUrl } } });
        vi.stubGlobal("fetch", fetchMock);
        stubObjectUrlHelpers();

        await downloadAttachment({
            filename: "invoice.pdf",
            name: "legacy.pdf",
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
        expect(fetchMock).toHaveBeenCalledWith(signedUrl);
        expect(link.download).toBe("invoice.pdf");
        expect(click).toHaveBeenCalledTimes(1);
    });

    it("canonicalizes unsafe filenames for the browser download name", async () => {
        const { downloadAttachment } = await import("./downloadAttachment");
        const link = document.createElement("a");
        vi.spyOn(link, "click").mockImplementation(vi.fn());
        vi.spyOn(document, "createElement").mockReturnValue(link);
        sendInformation.mockResolvedValue({
            data: { data: { uploadUrl: "https://signed.example/attachments/email-id/evil.pdf?X-Amz-Signature=ok" } },
        });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ blob: vi.fn().mockResolvedValue(new Blob(["x"])) }));
        stubObjectUrlHelpers();

        await downloadAttachment({
            filename: "../../evil.pdf",
            url: "https://bucket.s3.amazonaws.com/attachments/email-id/evil.pdf",
        });

        expect(link.download).toBe("evil.pdf");
    });

    it("fails without fetching when /download-s3-files does not return a signed URL", async () => {
        const { downloadAttachment } = await import("./downloadAttachment");
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        sendInformation.mockResolvedValue({ data: { data: {} } });

        await expect(
            downloadAttachment({
                filename: "invoice.pdf",
                url: "https://bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf",
            }),
        ).rejects.toThrow("missing_attachment_download_url");

        expect(fetchMock).not.toHaveBeenCalled();
    });
});
