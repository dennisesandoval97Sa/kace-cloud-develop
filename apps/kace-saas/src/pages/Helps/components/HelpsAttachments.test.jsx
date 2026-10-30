import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HelpsAttachments from "./HelpsAttachments";

const mocks = vi.hoisted(() => ({
    deleteFile: vi.fn(),
    downloadFile: vi.fn(),
    getUrlS3File: vi.fn(),
    sendInformation: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
    toastSuccess: vi.fn(),
    toastWarning: vi.fn(),
    useConfigAgentData: vi.fn(),
    useGenericSearchQuery: vi.fn(),
}));

vi.mock("@kace/hooks/useGenericSearchQuery", () => ({
    default: mocks.useGenericSearchQuery,
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: mocks.useConfigAgentData,
}));

vi.mock("@/components/core/Attachment/hooks/useAttachmentsS3", () => ({
    default: () => mocks,
}));

vi.mock("@/services/generic-send-information", () => ({
    sendInformation: mocks.sendInformation,
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        info: mocks.toastInfo,
        success: mocks.toastSuccess,
        warning: mocks.toastWarning,
    },
}));

describe("HelpsAttachments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useConfigAgentData.mockReturnValue({
            allowed_file_extensions: [".txt"],
            maximun_size_allowed: 5,
            quantity_files_allowed: 5,
            isLoading: false,
            isFetching: false,
        });
        mocks.useGenericSearchQuery.mockReturnValue({ data: [], isLoading: false });
        mocks.sendInformation.mockResolvedValue({
            status: 201,
            data: { data: { id: "server-attachment-id" } },
        });
    });

    it("keeps create-mode files pending without uploading them", async () => {
        const onPendingAttachmentsChange = vi.fn();
        const file = new File(["pending help file"], "guide.txt", { type: "text/plain" });
        const user = userEvent.setup();

        render(
            <HelpsAttachments
                deferredUpload
                pendingAttachments={[]}
                onPendingAttachmentsChange={onPendingAttachmentsChange}
            />,
        );

        await user.upload(screen.getByTestId("file_drop_download"), file);

        await waitFor(() => {
            expect(onPendingAttachmentsChange).toHaveBeenCalledWith([
                expect.objectContaining({
                    path: "guide.txt",
                    tipo: "text/plain",
                    fileData: file,
                    status: "pending",
                }),
            ]);
        });
        expect(mocks.getUrlS3File).not.toHaveBeenCalled();
    });

    it("rejects Help attachments outside the active group's configured formats and per-file size", async () => {
        const onPendingAttachmentsChange = vi.fn();
        const disallowedFile = new File(["%PDF"], "manual.pdf", { type: "application/pdf" });
        const oversizedFile = new File([new Uint8Array(1024 * 1024 + 1)], "large.txt", { type: "text/plain" });
        mocks.useConfigAgentData.mockReturnValue({
            allowed_file_extensions: [".txt"],
            maximun_size_allowed: 1,
            quantity_files_allowed: 5,
            isLoading: false,
            isFetching: false,
        });
        const user = userEvent.setup({ applyAccept: false });

        render(
            <HelpsAttachments
                deferredUpload
                pendingAttachments={[]}
                onPendingAttachmentsChange={onPendingAttachmentsChange}
            />,
        );

        await user.upload(screen.getByTestId("file_drop_download"), [disallowedFile, oversizedFile]);

        await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalled());
        expect(onPendingAttachmentsChange).not.toHaveBeenCalled();
        expect(mocks.getUrlS3File).not.toHaveBeenCalled();
    });

    it("queues Help attachments in selection order only up to the active group's remaining capacity", async () => {
        const existingAttachment = {
            id: "existing",
            path: "existing.txt",
            status: "pending",
        };
        const firstFile = new File(["first"], "first.txt", { type: "text/plain" });
        const secondFile = new File(["second"], "second.txt", { type: "text/plain" });
        const onPendingAttachmentsChange = vi.fn();
        mocks.useConfigAgentData.mockReturnValue({
            allowed_file_extensions: [".txt"],
            maximun_size_allowed: 5,
            quantity_files_allowed: 2,
            isLoading: false,
            isFetching: false,
        });
        const user = userEvent.setup();

        render(
            <HelpsAttachments
                deferredUpload
                pendingAttachments={[existingAttachment]}
                onPendingAttachmentsChange={onPendingAttachmentsChange}
            />,
        );

        await user.upload(screen.getByTestId("file_drop_download"), [firstFile, secondFile]);

        await waitFor(() => {
            expect(onPendingAttachmentsChange).toHaveBeenCalledWith([
                expect.objectContaining({ path: "first.txt", fileData: firstFile }),
                existingAttachment,
            ]);
        });
        expect(onPendingAttachmentsChange).not.toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ path: "second.txt" })]),
        );
        expect(mocks.getUrlS3File).not.toHaveBeenCalled();
    });

    it("uses the canonical attachment ID for immediate edit-mode actions", async () => {
        const file = new File(["persisted help file"], "persisted.txt", {
            type: "text/plain",
        });
        mocks.getUrlS3File.mockResolvedValue([{ id: "server-help-id", fileData: file }]);
        const user = userEvent.setup();

        render(<HelpsAttachments helpId="server-help-id" />);

        await user.upload(screen.getByTestId("file_drop_download"), file);
        await user.click(await screen.findByTestId("btn_file_list_delete"));

        expect(mocks.deleteFile).toHaveBeenCalledWith("server-attachment-id", expect.any(String));
    });

    it("deletes deferred successes remotely while failed files stay local-only", async () => {
        const onPendingAttachmentsChange = vi.fn();
        const successfulAttachment = {
            id: "server-success-id",
            path: "persisted.txt",
            status: "success",
        };
        const failedAttachment = {
            id: "pending-failed-id",
            path: "rejected.txt",
            status: "failed",
            errorCode: "0x120001",
        };
        mocks.deleteFile.mockResolvedValue(true);
        const user = userEvent.setup();

        render(
            <HelpsAttachments
                helpId="server-help-id"
                deferredUpload
                pendingAttachments={[successfulAttachment, failedAttachment]}
                onPendingAttachmentsChange={onPendingAttachmentsChange}
            />,
        );

        await user.click(within(screen.getByText("persisted.txt").closest("li")).getByTestId("btn_file_list_delete"));
        await waitFor(() => expect(mocks.deleteFile).toHaveBeenCalledWith("server-success-id", expect.any(String)));

        await user.click(within(screen.getByText("rejected.txt").closest("li")).getByTestId("btn_file_list_delete"));

        expect(mocks.deleteFile).toHaveBeenCalledTimes(1);
        expect(onPendingAttachmentsChange).toHaveBeenNthCalledWith(1, [failedAttachment]);
        expect(onPendingAttachmentsChange).toHaveBeenNthCalledWith(2, []);
    });
});
