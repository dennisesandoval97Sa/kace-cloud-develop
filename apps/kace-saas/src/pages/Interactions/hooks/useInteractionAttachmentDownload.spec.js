import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
    buildInteractionAttachmentDownloadPayload,
    useInteractionAttachmentDownload,
} from "./useInteractionAttachmentDownload";
import { sendInformation } from "@/services/generic-send-information";
import { S3_FILES_DOWNLOAD_SERVICE } from "@/utils/URL";
import { toast } from "sonner";

vi.mock("@/services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
    },
}));

describe("useInteractionAttachmentDownload", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("open", vi.fn());
    });

    it("builds a /download-s3-files payload from the stored private S3 URL", () => {
        expect(
            buildInteractionAttachmentDownloadPayload({
                url: "https://bucket.s3.amazonaws.com/attachments/email-id/uuid_invoice.pdf",
                contentType: "application/pdf",
            }),
        ).toEqual({
            url: "attachments",
            id: "email-id",
            fileName: "uuid_invoice.pdf",
            contentType: "application/pdf",
        });
    });

    it("requests a signed URL on click and opens it in a new tab", async () => {
        const signedUrl = "https://bucket.s3.amazonaws.com/attachments/email-id/uuid_invoice.pdf?X-Amz-Signature=ok";
        sendInformation.mockResolvedValue({
            data: {
                data: {
                    uploadUrl: signedUrl,
                },
            },
        });

        const { result } = renderHook(() => useInteractionAttachmentDownload());

        await act(async () => {
            await result.current.openAttachment({
                url: "https://bucket.s3.amazonaws.com/attachments/email-id/uuid_invoice.pdf",
                contentType: "application/pdf",
            });
        });

        expect(sendInformation).toHaveBeenCalledWith({
            url: S3_FILES_DOWNLOAD_SERVICE,
            dataPost: {
                url: "attachments",
                id: "email-id",
                fileName: "uuid_invoice.pdf",
                contentType: "application/pdf",
            },
        });
        expect(window.open).toHaveBeenCalledWith(signedUrl, "_blank", "noopener,noreferrer");
    });

    it("surfaces API download errors without opening a new tab", async () => {
        sendInformation.mockRejectedValue({
            response: {
                data: {
                    message: "Attachment unavailable",
                },
            },
        });

        const { result } = renderHook(() => useInteractionAttachmentDownload());

        let openedUrl = "not-called";
        await act(async () => {
            openedUrl = await result.current.openAttachment({
                url: "https://bucket.s3.amazonaws.com/attachments/email-id/uuid_invoice.pdf",
                contentType: "application/pdf",
            });
        });

        expect(openedUrl).toBeNull();
        expect(toast.error).toHaveBeenCalledWith("Attachment unavailable");
        expect(window.open).not.toHaveBeenCalled();
    });

    it("keeps the generic download toast when the signed URL is missing", async () => {
        sendInformation.mockResolvedValue({
            data: {
                data: {},
            },
        });

        const { result } = renderHook(() => useInteractionAttachmentDownload());

        await act(async () => {
            await result.current.openAttachment({
                url: "https://bucket.s3.amazonaws.com/attachments/email-id/uuid_invoice.pdf",
                contentType: "application/pdf",
            });
        });

        expect(toast.error).toHaveBeenCalledWith("app.alerts.download_error");
        expect(window.open).not.toHaveBeenCalled();
    });
});
