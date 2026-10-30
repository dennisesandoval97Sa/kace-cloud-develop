import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import useHelpAttachments from "./useHelpAttachments";

const mocks = vi.hoisted(() => ({
    getUrlS3File: vi.fn(),
    sendInformation: vi.fn(),
}));

vi.mock("@/components/core/Attachment/hooks/useAttachmentsS3", () => ({
    default: () => ({ getUrlS3File: mocks.getUrlS3File }),
}));

vi.mock("@/services/generic-send-information", () => ({
    sendInformation: mocks.sendInformation,
}));

describe("useHelpAttachments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendInformation.mockResolvedValue({
            status: 201,
            data: { data: { id: "server-attachment-id" } },
        });
    });

    it("returns the canonical attachment ID from the create response", async () => {
        const file = new File(["persisted"], "persisted.txt", {
            type: "text/plain",
        });
        const { result } = renderHook(() => useHelpAttachments());

        let savedAttachments;
        await act(async () => {
            savedAttachments = await result.current.saveAttachmentsHelp("server-help-id", [
                { id: "server-help-id", fileData: file },
            ]);
        });

        expect(savedAttachments).toEqual([
            expect.objectContaining({
                id: "server-attachment-id",
                help_id: "server-help-id",
                fileData: file,
            }),
        ]);
    });

    it("uploads pending files with the persisted Help ID", async () => {
        const firstFile = new File(["first"], "first.txt", { type: "text/plain" });
        const secondFile = new File(["second"], "second.txt", { type: "text/plain" });
        const pendingAttachments = [
            { id: "pending-1", fileData: firstFile, status: "pending" },
            { id: "pending-2", fileData: secondFile, status: "pending" },
        ];
        mocks.getUrlS3File.mockImplementation(async (helpId, [file]) => [{ id: helpId, fileData: file }]);
        const { result } = renderHook(() => useHelpAttachments());

        let attachmentOutcomes;
        await act(async () => {
            attachmentOutcomes = await result.current.uploadPendingAttachments("server-help-id", pendingAttachments);
        });

        expect(mocks.getUrlS3File).toHaveBeenNthCalledWith(1, "server-help-id", [firstFile], "helps");
        expect(mocks.getUrlS3File).toHaveBeenNthCalledWith(2, "server-help-id", [secondFile], "helps");
        expect(mocks.sendInformation).toHaveBeenCalledWith({
            id: null,
            url: expect.any(String),
            dataPost: {
                help_id: "server-help-id",
                path: "first.txt",
                tipo: "text/plain",
            },
        });
        expect(attachmentOutcomes).toEqual([
            expect.objectContaining({ id: "server-attachment-id", fileData: firstFile, status: "success" }),
            expect.objectContaining({ id: "server-attachment-id", fileData: secondFile, status: "success" }),
        ]);
    });

    it("preserves successful and failed outcomes from a mixed batch", async () => {
        const successfulFile = new File(["success"], "success.txt", { type: "text/plain" });
        const failedFile = new File(["failure"], "failure.txt", { type: "text/plain" });
        const pendingAttachments = [
            { id: "pending-success", fileData: successfulFile, status: "pending" },
            { id: "pending-failure", fileData: failedFile, status: "pending" },
        ];
        mocks.getUrlS3File.mockImplementation(async (helpId, [file]) => {
            if (file === failedFile) throw new Error("upload_error");
            return [{ id: helpId, fileData: file }];
        });
        const { result } = renderHook(() => useHelpAttachments());

        let attachmentOutcomes;
        await act(async () => {
            attachmentOutcomes = await result.current.uploadPendingAttachments("server-help-id", pendingAttachments);
        });

        expect(attachmentOutcomes).toEqual([
            expect.objectContaining({
                id: "server-attachment-id",
                fileData: successfulFile,
                status: "success",
            }),
            expect.objectContaining({
                id: "pending-failure",
                fileData: failedFile,
                status: "failed",
                errorReason: "upload_error",
            }),
        ]);
        expect(mocks.sendInformation).toHaveBeenCalledTimes(1);
    });

    it("preserves existing successes and records a safe public failure reason without retrying success", async () => {
        const persistedFile = new File(["persisted"], "persisted.txt", { type: "text/plain" });
        const rejectedFile = new File(["rejected"], "select report.pdf", { type: "application/pdf" });
        const persistedAttachment = {
            id: "server-attachment-id",
            fileData: persistedFile,
            status: "success",
        };
        const pendingAttachment = {
            id: "pending-rejected",
            fileData: rejectedFile,
            status: "failed",
        };
        mocks.getUrlS3File.mockResolvedValue([{ id: "server-help-id", fileData: rejectedFile }]);
        mocks.sendInformation.mockRejectedValue({
            response: {
                data: {
                    data: { code: PUBLIC_ERROR_CODES.HELP_ATTACHMENT_FILENAME_REJECTED },
                },
            },
        });
        const { result } = renderHook(() => useHelpAttachments());

        let attachmentOutcomes;
        await act(async () => {
            attachmentOutcomes = await result.current.uploadPendingAttachments("server-help-id", [
                persistedAttachment,
                pendingAttachment,
            ]);
        });

        expect(attachmentOutcomes).toEqual([
            persistedAttachment,
            expect.objectContaining({
                id: "pending-rejected",
                status: "failed",
                errorCode: PUBLIC_ERROR_CODES.HELP_ATTACHMENT_FILENAME_REJECTED,
                errorReason: "filename_rejected",
            }),
        ]);
        expect(mocks.getUrlS3File).toHaveBeenCalledTimes(1);
        expect(mocks.getUrlS3File).toHaveBeenCalledWith("server-help-id", [rejectedFile], "helps");
    });

    it("marks a file failed when S3 preparation returns no uploaded file", async () => {
        const file = new File(["empty result"], "empty.txt", { type: "text/plain" });
        const pendingAttachment = { id: "pending-empty", fileData: file, status: "pending" };
        mocks.getUrlS3File.mockResolvedValue([]);
        const { result } = renderHook(() => useHelpAttachments());

        let attachmentOutcomes;
        await act(async () => {
            attachmentOutcomes = await result.current.uploadPendingAttachments("server-help-id", [pendingAttachment]);
        });

        expect(attachmentOutcomes).toEqual([
            expect.objectContaining({
                id: "pending-empty",
                status: "failed",
                errorReason: "upload_error",
            }),
        ]);
        expect(mocks.sendInformation).not.toHaveBeenCalled();
    });

    it("clears prior failure metadata after a successful retry", async () => {
        const file = new File(["retry"], "retry.txt", { type: "text/plain" });
        const failedAttachment = {
            id: "pending-retry",
            fileData: file,
            status: "failed",
            errorCode: PUBLIC_ERROR_CODES.HELP_ATTACHMENT_FILENAME_REJECTED,
            errorReason: "filename_rejected",
        };
        mocks.getUrlS3File.mockResolvedValue([{ id: "server-help-id", fileData: file }]);
        const { result } = renderHook(() => useHelpAttachments());

        let attachmentOutcomes;
        await act(async () => {
            attachmentOutcomes = await result.current.uploadPendingAttachments("server-help-id", [failedAttachment]);
        });

        expect(attachmentOutcomes).toEqual([
            expect.objectContaining({
                id: "server-attachment-id",
                status: "success",
                errorCode: undefined,
                errorReason: undefined,
            }),
        ]);
    });
});
