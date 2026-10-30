import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttachmentContainer from "./AttachmentContainer";

const mocks = vi.hoisted(() => ({
    deleteFile: vi.fn(),
    downloadFile: vi.fn(),
    getUrlS3File: vi.fn(),
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: () => ({
        allowed_file_extensions: [".txt"],
        maximun_size_allowed: 5,
        quantity_files_allowed: 5,
        isLoading: false,
        isFetching: false,
    }),
}));

vi.mock("./hooks/useAttachmentsS3", () => ({
    default: () => mocks,
}));

describe("AttachmentContainer download availability", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not expose Download for deferred pending files in the multiple-file layout", () => {
        const pendingFile = {
            id: "pending-attachment-id",
            path: "pending.txt",
            fileData: new File(["pending"], "pending.txt", { type: "text/plain" }),
            status: "pending",
        };

        render(
            <AttachmentContainer
                keyService="helps"
                currentListAttachments={[pendingFile]}
                multipleFiles
                deferredUpload
            />,
        );

        expect(screen.queryByTestId("btn_file_list_download")).not.toBeInTheDocument();
        expect(mocks.downloadFile).not.toHaveBeenCalled();
    });

    it("downloads persisted files in the default multiple-file layout", async () => {
        const persistedFile = {
            id: "server-attachment-id",
            path: "persisted.txt",
            tipo: "text/plain",
        };
        const user = userEvent.setup();
        mocks.downloadFile.mockResolvedValue(null);

        render(
            <AttachmentContainer
                keyService="helps"
                attachmentId="server-help-id"
                currentListAttachments={[persistedFile]}
                multipleFiles
            />,
        );

        await user.click(screen.getByTestId("btn_file_list_download"));

        expect(mocks.downloadFile).toHaveBeenCalledWith("server-help-id", persistedFile, "helps");
    });

    it("downloads successful files in the deferred multiple-file layout", async () => {
        const successfulFile = {
            id: "server-attachment-id",
            path: "successful.txt",
            tipo: "text/plain",
            status: "success",
        };
        const user = userEvent.setup();
        mocks.downloadFile.mockResolvedValue(null);

        render(
            <AttachmentContainer
                keyService="helps"
                attachmentId="server-help-id"
                currentListAttachments={[successfulFile]}
                multipleFiles
                deferredUpload
            />,
        );

        await user.click(screen.getByTestId("btn_file_list_download"));

        expect(mocks.downloadFile).toHaveBeenCalledWith("server-help-id", successfulFile, "helps");
    });

    it("does not expose Download for deferred pending files in the single-file layout", () => {
        const pendingFile = {
            id: "pending-attachment-id",
            path: "pending.txt",
            fileData: new File(["pending"], "pending.txt", { type: "text/plain" }),
            status: "pending",
        };

        render(<AttachmentContainer keyService="helps" currentListAttachments={[pendingFile]} deferredUpload />);

        expect(screen.queryByTestId("btn_file_upload")).not.toBeInTheDocument();
        expect(mocks.downloadFile).not.toHaveBeenCalled();
    });

    it("downloads a persisted file in the default single-file layout", async () => {
        const persistedFile = {
            id: "server-attachment-id",
            path: "persisted.txt",
            tipo: "text/plain",
        };
        const user = userEvent.setup();
        mocks.downloadFile.mockResolvedValue(null);

        render(
            <AttachmentContainer
                keyService="helps"
                attachmentId="server-help-id"
                currentListAttachments={[persistedFile]}
            />,
        );

        await user.click(screen.getByTestId("btn_file_upload"));

        expect(mocks.downloadFile).toHaveBeenCalledWith("server-help-id", persistedFile, "helps");
    });

    it("downloads a successful file in the deferred single-file layout", async () => {
        const successfulFile = {
            id: "server-attachment-id",
            path: "successful.txt",
            tipo: "text/plain",
            status: "success",
        };
        const user = userEvent.setup();
        mocks.downloadFile.mockResolvedValue(null);

        render(
            <AttachmentContainer
                keyService="helps"
                attachmentId="server-help-id"
                currentListAttachments={[successfulFile]}
                deferredUpload
            />,
        );

        await user.click(screen.getByTestId("btn_file_upload"));

        expect(mocks.downloadFile).toHaveBeenCalledWith("server-help-id", successfulFile, "helps");
    });
});
