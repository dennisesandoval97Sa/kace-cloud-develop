import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import useAttachmentsActions from "./useAttachmentsActions";
import useAttachmentsS3 from "./useAttachmentsS3";
import { processFiles } from "../utils/fileProcessor";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}));

vi.mock("@kace/plugins", () => ({
    Uuid: () => "local-file-id",
}));

vi.mock("./useAttachmentsS3", () => ({
    default: vi.fn(),
}));

vi.mock("../utils/fileProcessor", () => ({
    getAllowedExtensions: vi.fn(() => []),
    processFiles: vi.fn(),
}));

const createProps = (overrides = {}) => ({
    currentListAttachments: [],
    keyService: "template",
    attachmentService: "/template-attachments",
    attachmentId: "",
    allowedFileTypes: [],
    multipleFiles: true,
    handleFiles: vi.fn(),
    saveAttachments: vi.fn(),
    disabled: false,
    deferredUpload: true,
    allowedFileExtensions: [".pdf"],
    maximunSizeAllowed: 10,
    quantityFilesAllowed: 5,
    ...overrides,
});

const createDeferred = () => {
    let resolvePromise;
    const promise = new Promise((resolve) => {
        resolvePromise = resolve;
    });

    return { promise, resolve: resolvePromise };
};

describe("useAttachmentsActions", () => {
    const getUrlS3File = vi.fn();
    const downloadFile = vi.fn();
    const deleteFile = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        useAttachmentsS3.mockReturnValue({ getUrlS3File, downloadFile, deleteFile });
        vi.stubGlobal("open", vi.fn());
        vi.stubGlobal("URL", {
            ...URL,
            createObjectURL: vi.fn(() => "blob:queued-file"),
            revokeObjectURL: vi.fn(),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("removes a queued file without deleting it remotely and notifies the owner once", async () => {
        const handleFiles = vi.fn();
        const props = createProps({
            handleFiles,
            currentListAttachments: [
                { id: "pending-1", pending: true },
                { id: "saved-1", pending: false },
            ],
        });
        const { result } = renderHook(() => useAttachmentsActions(props), { wrapper: StrictMode });

        await act(async () => {
            await result.current.handleDelete("pending-1");
        });

        expect(result.current.listAttachment).toEqual([{ id: "saved-1", pending: false }]);
        expect(handleFiles).toHaveBeenCalledTimes(1);
        expect(handleFiles).toHaveBeenCalledWith([{ id: "saved-1", pending: false }]);
        expect(deleteFile).not.toHaveBeenCalled();
    });

    it("releases a queued file preview URL after the browser has opened it", async () => {
        vi.useFakeTimers();
        const fileData = new File(["manual"], "manual.pdf", { type: "application/pdf" });
        const props = createProps();
        const { result } = renderHook(() => useAttachmentsActions(props));

        await act(async () => {
            await result.current.handleDownload({ id: "pending-1", pending: true, fileData });
        });

        expect(URL.createObjectURL).toHaveBeenCalledWith(fileData);
        expect(window.open).toHaveBeenCalledWith("blob:queued-file", "_blank", "noopener,noreferrer");
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(60_000));

        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:queued-file");
    });

    it("confirms that a deferred file is queued for upload on save", async () => {
        const fileData = new File(["manual"], "manual.pdf", { type: "application/pdf" });
        const handleFiles = vi.fn();
        processFiles.mockResolvedValue([fileData]);
        const props = createProps({ handleFiles });
        const { result } = renderHook(() => useAttachmentsActions(props));

        await act(async () => {
            await result.current.handleUpload([fileData]);
        });

        expect(handleFiles).toHaveBeenCalledWith([
            {
                id: "local-file-id",
                path: "manual.pdf",
                tipo: "application/pdf",
                fileData,
                pending: true,
                status: "pending",
            },
        ]);
        expect(toast.success).toHaveBeenCalledWith("app.alerts.attachment_queued");
    });

    it("uses the active group's configured formats and per-file maximum size", async () => {
        const fileData = new File(["manual"], "manual.txt", { type: "text/plain" });
        processFiles.mockResolvedValue([]);
        const props = createProps({
            allowedFileExtensions: [".txt"],
            maximunSizeAllowed: 7,
        });
        const { result } = renderHook(() => useAttachmentsActions(props));

        await act(async () => {
            await result.current.handleUpload([fileData]);
        });

        expect(processFiles).toHaveBeenCalledWith([fileData], [".txt"], 7 * 1024 * 1024);
    });

    it("accepts files in selection order up to the remaining configured capacity", async () => {
        const existingAttachment = { id: "existing", path: "existing.pdf" };
        const firstFile = new File(["first"], "first.pdf", { type: "application/pdf" });
        const secondFile = new File(["second"], "second.pdf", { type: "application/pdf" });
        const thirdFile = new File(["third"], "third.pdf", { type: "application/pdf" });
        const handleFiles = vi.fn();
        processFiles.mockResolvedValue([firstFile, secondFile, thirdFile]);
        const props = createProps({
            currentListAttachments: [existingAttachment],
            handleFiles,
            quantityFilesAllowed: 2,
        });
        const { result } = renderHook(() => useAttachmentsActions(props));

        await act(async () => {
            await result.current.handleUpload([firstFile, secondFile, thirdFile]);
        });

        expect(handleFiles).toHaveBeenCalledWith([
            expect.objectContaining({ path: "first.pdf", fileData: firstFile }),
            existingAttachment,
        ]);
        expect(result.current.listAttachment).toHaveLength(2);
        expect(result.current.listAttachment[0].fileData).toBe(firstFile);
        expect(toast.warning).toHaveBeenCalledWith("app.alerts.attachmentLimitExceeded");
    });

    it("keeps over-limit existing attachments and blocks additional files", async () => {
        const existingAttachments = [
            { id: "existing-1", path: "existing-1.pdf" },
            { id: "existing-2", path: "existing-2.pdf" },
        ];
        const newFile = new File(["new"], "new.pdf", { type: "application/pdf" });
        const handleFiles = vi.fn();
        processFiles.mockResolvedValue([newFile]);
        const props = createProps({
            currentListAttachments: existingAttachments,
            handleFiles,
            quantityFilesAllowed: 1,
        });
        const { result } = renderHook(() => useAttachmentsActions(props));

        await act(async () => {
            await result.current.handleUpload([newFile]);
        });

        expect(result.current.listAttachment).toEqual(existingAttachments);
        expect(handleFiles).not.toHaveBeenCalled();
        expect(getUrlS3File).not.toHaveBeenCalled();
        expect(deleteFile).not.toHaveBeenCalled();
        expect(toast.warning).toHaveBeenCalledWith("app.alerts.attachmentLimitExceeded");
    });

    it("treats a zero configured count as unlimited", async () => {
        const firstFile = new File(["first"], "first.pdf", { type: "application/pdf" });
        const secondFile = new File(["second"], "second.pdf", { type: "application/pdf" });
        const handleFiles = vi.fn();
        processFiles.mockResolvedValue([firstFile, secondFile]);
        const props = createProps({
            handleFiles,
            quantityFilesAllowed: 0,
        });
        const { result } = renderHook(() => useAttachmentsActions(props));

        await act(async () => {
            await result.current.handleUpload([firstFile, secondFile]);
        });

        expect(result.current.listAttachment).toHaveLength(2);
        expect(handleFiles).toHaveBeenCalledWith([
            expect.objectContaining({ fileData: firstFile }),
            expect.objectContaining({ fileData: secondFile }),
        ]);
        expect(toast.warning).not.toHaveBeenCalled();
    });

    it("keeps a persisted attachment counted when deletion fails", async () => {
        const existingAttachment = { id: "existing", path: "existing.pdf" };
        const handleFiles = vi.fn();
        deleteFile.mockResolvedValue(false);
        const props = createProps({
            currentListAttachments: [existingAttachment],
            deferredUpload: false,
            handleFiles,
            quantityFilesAllowed: 1,
        });
        const { result } = renderHook(() => useAttachmentsActions(props));

        await act(async () => {
            await result.current.handleDelete(existingAttachment.id, existingAttachment);
        });

        expect(deleteFile).toHaveBeenCalledWith(existingAttachment.id, "/template-attachments");
        expect(result.current.listAttachment).toEqual([existingAttachment]);
        expect(handleFiles).not.toHaveBeenCalled();
    });

    it("releases persisted attachment capacity after deletion succeeds", async () => {
        const existingAttachment = { id: "existing", path: "existing.pdf" };
        const handleFiles = vi.fn();
        deleteFile.mockResolvedValue(true);
        const props = createProps({
            currentListAttachments: [existingAttachment],
            deferredUpload: false,
            handleFiles,
            quantityFilesAllowed: 1,
        });
        const { result } = renderHook(() => useAttachmentsActions(props));

        await act(async () => {
            await result.current.handleDelete(existingAttachment.id, existingAttachment);
        });

        expect(deleteFile).toHaveBeenCalledWith(existingAttachment.id, "/template-attachments");
        expect(result.current.listAttachment).toEqual([]);
        expect(handleFiles).toHaveBeenCalledWith([]);
    });

    it("keeps both deferred batches when validations finish out of order", async () => {
        const firstFile = new File(["first"], "first.pdf", { type: "application/pdf" });
        const secondFile = new File(["second"], "second.pdf", { type: "application/pdf" });
        const firstValidation = createDeferred();
        const secondValidation = createDeferred();
        const handleFiles = vi.fn();
        processFiles.mockReturnValueOnce(firstValidation.promise).mockReturnValueOnce(secondValidation.promise);
        const props = createProps({ handleFiles });
        const { result } = renderHook(() => useAttachmentsActions(props));

        let firstUpload;
        let secondUpload;
        act(() => {
            firstUpload = result.current.handleUpload([firstFile]);
            secondUpload = result.current.handleUpload([secondFile]);
        });

        await act(async () => {
            secondValidation.resolve([secondFile]);
            await secondUpload;
            firstValidation.resolve([firstFile]);
            await firstUpload;
        });

        expect(result.current.listAttachment.map(({ fileData }) => fileData.name)).toEqual(["first.pdf", "second.pdf"]);
        expect(handleFiles).toHaveBeenLastCalledWith(result.current.listAttachment);
    });

    it("reserves configured capacity across overlapping uploads", async () => {
        const firstFile = new File(["first"], "first.pdf", { type: "application/pdf" });
        const secondFile = new File(["second"], "second.pdf", { type: "application/pdf" });
        const firstUploadResponse = createDeferred();
        processFiles.mockImplementation(async (files) => Array.from(files));
        getUrlS3File.mockReturnValueOnce(firstUploadResponse.promise);
        const props = createProps({
            deferredUpload: false,
            quantityFilesAllowed: 1,
        });
        const { result } = renderHook(() => useAttachmentsActions(props));

        let firstUpload;
        let secondUpload;
        act(() => {
            firstUpload = result.current.handleUpload([firstFile]);
            secondUpload = result.current.handleUpload([secondFile]);
        });

        await act(async () => {
            await secondUpload;
            firstUploadResponse.resolve([{ id: "uploaded-first", fileData: firstFile }]);
            await firstUpload;
        });

        expect(getUrlS3File).toHaveBeenCalledTimes(1);
        expect(getUrlS3File).toHaveBeenCalledWith("", [firstFile], "template");
        expect(result.current.listAttachment).toHaveLength(1);
        expect(result.current.listAttachment[0].fileData).toBe(firstFile);
        expect(toast.warning).toHaveBeenCalledWith("app.alerts.attachmentLimitExceeded");
    });

    it("stays busy until every overlapping file validation finishes", async () => {
        const firstFile = new File(["first"], "first.pdf", { type: "application/pdf" });
        const secondFile = new File(["second"], "second.pdf", { type: "application/pdf" });
        const firstValidation = createDeferred();
        const secondValidation = createDeferred();
        processFiles.mockReturnValueOnce(firstValidation.promise).mockReturnValueOnce(secondValidation.promise);
        const props = createProps();
        const { result } = renderHook(() => useAttachmentsActions(props));

        let firstUpload;
        let secondUpload;
        act(() => {
            firstUpload = result.current.handleUpload([firstFile]);
            secondUpload = result.current.handleUpload([secondFile]);
        });

        expect(result.current.isUploading).toBe(true);

        await act(async () => {
            secondValidation.resolve([secondFile]);
            await secondUpload;
        });

        expect(result.current.isUploading).toBe(true);

        await act(async () => {
            firstValidation.resolve([firstFile]);
            await firstUpload;
        });

        expect(result.current.isUploading).toBe(false);
    });
});
