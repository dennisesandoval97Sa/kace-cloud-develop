import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttachmentContainer from "./AttachmentContainer";

const mocks = vi.hoisted(() => ({
    useAttachmentsActions: vi.fn(),
    useConfigAgentData: vi.fn(),
}));

vi.mock("./hooks/useAttachmentsActions", () => ({
    default: mocks.useAttachmentsActions,
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: mocks.useConfigAgentData,
}));

describe("AttachmentContainer", () => {
    beforeEach(() => {
        mocks.useAttachmentsActions.mockReturnValue({
            handleUpload: vi.fn(),
            handleDelete: vi.fn(),
            handleDownload: vi.fn(),
            listAttachment: [],
            isUploading: false,
        });
        mocks.useConfigAgentData.mockReturnValue({
            allowed_file_extensions: [],
            maximun_size_allowed: 0,
            quantity_files_allowed: 0,
            isLoading: true,
            isFetching: true,
        });
    });

    it("disables uploads while attachment configuration is loading", () => {
        render(<AttachmentContainer keyService="helps" multipleFiles />);

        expect(screen.getByTestId("file_drop_download")).toBeDisabled();
        expect(mocks.useAttachmentsActions).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
    });

    it("enables uploads after attachment configuration loads", () => {
        mocks.useConfigAgentData.mockReturnValue({
            allowed_file_extensions: [".pdf"],
            maximun_size_allowed: 5,
            quantity_files_allowed: 1,
            isLoading: false,
            isFetching: false,
        });

        render(<AttachmentContainer keyService="helps" multipleFiles />);

        expect(screen.getByTestId("file_drop_download")).not.toBeDisabled();
        expect(mocks.useAttachmentsActions).toHaveBeenCalledWith(
            expect.objectContaining({
                disabled: false,
                allowedFileExtensions: [".pdf"],
                maximunSizeAllowed: 5,
                quantityFilesAllowed: 1,
            }),
        );
    });

    it("keeps uploads disabled until existing attachments finish loading", () => {
        mocks.useConfigAgentData.mockReturnValue({
            allowed_file_extensions: [".pdf"],
            maximun_size_allowed: 5,
            quantity_files_allowed: 2,
            isLoading: false,
            isFetching: false,
        });

        render(<AttachmentContainer keyService="helps" multipleFiles isLoadingCurrentListAttachments />);

        expect(screen.getByTestId("file_drop_download")).toBeDisabled();
        expect(mocks.useAttachmentsActions).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
    });

    it("preserves existing attachments and blocks uploads when the configured count is reached", () => {
        const existingAttachment = { id: "existing-attachment", path: "existing.pdf" };
        const handleDelete = vi.fn();
        mocks.useAttachmentsActions.mockReturnValue({
            handleUpload: vi.fn(),
            handleDelete,
            handleDownload: vi.fn(),
            listAttachment: [existingAttachment],
            isUploading: false,
        });
        mocks.useConfigAgentData.mockReturnValue({
            allowed_file_extensions: [".pdf"],
            maximun_size_allowed: 5,
            quantity_files_allowed: 1,
            isLoading: false,
            isFetching: false,
        });

        render(<AttachmentContainer keyService="helps" multipleFiles currentListAttachments={[existingAttachment]} />);

        expect(screen.getByTestId("file_drop_download")).toBeDisabled();
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("existing.pdf")).toBeInTheDocument();
        expect(handleDelete).not.toHaveBeenCalled();
    });

    it("passes effective allowed extensions from useAttachmentsActions to FileDropZone", () => {
        mocks.useAttachmentsActions.mockReturnValue({
            handleUpload: vi.fn(),
            handleDelete: vi.fn(),
            handleDownload: vi.fn(),
            listAttachment: [],
            isUploading: false,
            allowedExtensions: [".csv"],
        });
        mocks.useConfigAgentData.mockReturnValue({
            allowed_file_extensions: [".pdf", ".png", ".csv"],
            maximun_size_allowed: 5,
            quantity_files_allowed: 1,
            isLoading: false,
            isFetching: false,
        });

        render(<AttachmentContainer keyService="helps" allowedFileTypes={["csv"]} />);

        const fileInput = screen.getByTestId("file_drop_download");
        expect(fileInput).toHaveAttribute("accept", ".csv");
        expect(screen.getByText(/\.csv/)).toBeInTheDocument();
    });
});
