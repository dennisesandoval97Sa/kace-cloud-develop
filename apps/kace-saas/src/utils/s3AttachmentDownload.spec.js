import { describe, expect, it } from "vitest";
import { buildS3FileDownloadPayload, getS3SignedDownloadUrl } from "./s3AttachmentDownload";

describe("s3AttachmentDownload", () => {
    it("builds the signed-download payload from an S3 attachment URL", () => {
        const payload = buildS3FileDownloadPayload({
            url: "https://bucket.s3.amazonaws.com/cases/123/folder%20name/document.pdf",
            contentType: "application/pdf",
        });

        expect(payload).toEqual({
            url: "cases",
            id: "123",
            fileName: "folder name/document.pdf",
            contentType: "application/pdf",
        });
    });

    it("defaults content type when the attachment does not provide one", () => {
        const payload = buildS3FileDownloadPayload({
            url: "https://bucket.s3.amazonaws.com/cases/123/document.pdf",
        });

        expect(payload.contentType).toBe("application/octet-stream");
    });

    it("rejects invalid S3 object URLs", () => {
        expect(() => buildS3FileDownloadPayload({ url: "https://bucket.s3.amazonaws.com/cases/123" })).toThrow(
            "invalid_attachment_s3_url",
        );
    });

    it("reads the signed download URL from the API response", () => {
        expect(getS3SignedDownloadUrl({ data: { data: { uploadUrl: "https://signed.example/file" } } })).toBe(
            "https://signed.example/file",
        );
    });
});
