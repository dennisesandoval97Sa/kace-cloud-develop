import { afterEach, describe, expect, it, vi } from "vitest";

const sendInformation = vi.hoisted(() => vi.fn());
const zipFile = vi.fn();
const generateAsync = vi.fn().mockResolvedValue(new Blob(["zip"]));
const saveAs = vi.fn();

vi.mock("jszip", () => ({
    default: vi.fn().mockImplementation(() => ({
        file: zipFile,
        generateAsync,
    })),
}));

vi.mock("file-saver", () => ({
    saveAs,
}));

vi.mock("@/services/generic-send-information", () => ({
    sendInformation,
}));

describe("downloadAttachmentsZip", () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("uses filename for ZIP entries", async () => {
        const { downloadAttachmentsZip } = await import("./downloadAttachmentsZip");
        const blob = new Blob(["x"]);
        const signedUrl = "https://signed.example/attachments/email-id/invoice.pdf?X-Amz-Signature=ok";
        const fetchMock = vi.fn().mockResolvedValue({ blob: vi.fn().mockResolvedValue(blob) });

        sendInformation.mockResolvedValue({
            data: {
                data: {
                    uploadUrl: signedUrl,
                },
            },
        });
        vi.stubGlobal("fetch", fetchMock);

        await downloadAttachmentsZip([
            {
                filename: "invoice.pdf",
                name: "legacy.pdf",
                url: "https://bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf",
                contentType: "application/pdf",
            },
        ]);

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
        expect(zipFile).toHaveBeenCalledWith("invoice.pdf", blob);
        expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "attachments.zip");
    });

    it("canonicalizes unsafe filenames for ZIP entries", async () => {
        const { downloadAttachmentsZip } = await import("./downloadAttachmentsZip");
        const blob = new Blob(["x"]);
        const signedUrl = "https://signed.example/attachments/email-id/evil.pdf?X-Amz-Signature=ok";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ blob: vi.fn().mockResolvedValue(blob) }));
        sendInformation.mockResolvedValue({
            data: {
                data: {
                    uploadUrl: signedUrl,
                },
            },
        });

        await downloadAttachmentsZip([
            {
                filename: "../../evil.pdf",
                url: "https://bucket.s3.amazonaws.com/attachments/email-id/evil.pdf",
            },
        ]);

        expect(sendInformation).toHaveBeenCalledWith({
            url: "/download-s3-files",
            dataPost: {
                url: "attachments",
                id: "email-id",
                fileName: "evil.pdf",
                contentType: "application/octet-stream",
            },
        });
        expect(zipFile).toHaveBeenCalledWith("evil.pdf", blob);
    });

    it("fails before creating the ZIP when /download-s3-files does not return a signed URL", async () => {
        const { downloadAttachmentsZip } = await import("./downloadAttachmentsZip");
        const fetchMock = vi.fn();

        vi.stubGlobal("fetch", fetchMock);
        sendInformation.mockResolvedValue({
            data: {
                data: {},
            },
        });

        await expect(
            downloadAttachmentsZip([
                {
                    filename: "invoice.pdf",
                    url: "https://bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf",
                },
            ]),
        ).rejects.toThrow("missing_attachment_download_url");

        expect(fetchMock).not.toHaveBeenCalled();
        expect(generateAsync).not.toHaveBeenCalled();
        expect(saveAs).not.toHaveBeenCalled();
    });
});
