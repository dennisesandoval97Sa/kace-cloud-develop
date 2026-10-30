import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import AttachmentContainer from "./AttachmentContainer";
import { processFiles } from "./utils/fileProcessor";
import { validateFiles } from "@/utils/fileValidations";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}));

vi.mock("@kace/plugins", () => ({
    Uuid: (() => {
        let nextId = 0;
        return () => `local-file-${++nextId}`;
    })(),
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: () => ({
        allowed_file_extensions: [".pdf"],
        maximun_size_allowed: 5,
        quantity_files_allowed: 5,
    }),
}));

vi.mock("@/utils/fileValidations", () => ({
    ALLOWED_FILE_EXTENSIONS: {},
    ALL_ALLOWED_FILE_EXTENSIONS: [],
    formatValidationErrors: vi.fn(),
    validateFiles: vi.fn(),
}));

vi.mock("./hooks/useAttachmentsS3", () => ({
    default: () => ({
        getUrlS3File: vi.fn(),
        downloadFile: vi.fn(),
        deleteFile: vi.fn(),
    }),
}));

vi.mock("./utils/fileProcessor", () => ({
    getAllowedExtensions: vi.fn(() => [".pdf"]),
    processFiles: vi.fn(),
}));

const createDeferred = () => {
    let resolvePromise;
    const promise = new Promise((resolve) => {
        resolvePromise = resolve;
    });

    return { promise, resolve: resolvePromise };
};

describe("AttachmentContainer deferred validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reports processing across drop-zone and queue validation", async () => {
        const file = new File(["manual"], "manual.pdf", { type: "application/pdf" });
        const dropZoneValidation = createDeferred();
        const queueValidation = createDeferred();
        const onProcessingChange = vi.fn();
        validateFiles.mockReturnValueOnce(dropZoneValidation.promise);
        processFiles.mockReturnValueOnce(queueValidation.promise);

        render(
            <AttachmentContainer
                keyService="template"
                allowedFileTypes={[]}
                multipleFiles
                deferredUpload
                onProcessingChange={onProcessingChange}
            />,
        );

        fireEvent.change(screen.getByTestId("file_drop_download"), { target: { files: [file] } });

        expect(onProcessingChange).toHaveBeenLastCalledWith(true);
        expect(processFiles).not.toHaveBeenCalled();

        await act(async () => {
            dropZoneValidation.resolve({ valid: [file], invalid: [] });
            await dropZoneValidation.promise;
        });

        await waitFor(() => expect(processFiles).toHaveBeenCalledWith([file], [".pdf"], 5 * 1024 * 1024));
        expect(onProcessingChange).toHaveBeenCalledTimes(1);

        await act(async () => {
            queueValidation.resolve([file]);
            await queueValidation.promise;
        });

        await waitFor(() => expect(onProcessingChange).toHaveBeenLastCalledWith(false));
    });

    it("stays processing until all overlapping selection lifecycles finish", async () => {
        const firstFile = new File(["first"], "first.pdf", { type: "application/pdf" });
        const secondFile = new File(["second"], "second.pdf", { type: "application/pdf" });
        const firstDropZoneValidation = createDeferred();
        const secondDropZoneValidation = createDeferred();
        const firstQueueValidation = createDeferred();
        const secondQueueValidation = createDeferred();
        const onProcessingChange = vi.fn();
        validateFiles
            .mockReturnValueOnce(firstDropZoneValidation.promise)
            .mockReturnValueOnce(secondDropZoneValidation.promise);
        processFiles
            .mockReturnValueOnce(firstQueueValidation.promise)
            .mockReturnValueOnce(secondQueueValidation.promise);

        render(
            <AttachmentContainer
                keyService="template"
                allowedFileTypes={[]}
                multipleFiles
                deferredUpload
                onProcessingChange={onProcessingChange}
            />,
        );

        const input = screen.getByTestId("file_drop_download");
        fireEvent.change(input, { target: { files: [firstFile] } });
        fireEvent.change(input, { target: { files: [secondFile] } });

        expect(onProcessingChange).toHaveBeenCalledTimes(1);
        expect(onProcessingChange).toHaveBeenLastCalledWith(true);

        await act(async () => {
            secondDropZoneValidation.resolve({ valid: [secondFile], invalid: [] });
            await secondDropZoneValidation.promise;
        });
        await waitFor(() => expect(processFiles).toHaveBeenCalledWith([secondFile], [".pdf"], 5 * 1024 * 1024));

        await act(async () => {
            secondQueueValidation.resolve([secondFile]);
            await secondQueueValidation.promise;
        });
        expect(onProcessingChange).toHaveBeenCalledTimes(1);

        await act(async () => {
            firstDropZoneValidation.resolve({ valid: [firstFile], invalid: [] });
            await firstDropZoneValidation.promise;
        });
        await waitFor(() => expect(processFiles).toHaveBeenCalledWith([firstFile], [".pdf"], 5 * 1024 * 1024));

        await act(async () => {
            firstQueueValidation.resolve([firstFile]);
            await firstQueueValidation.promise;
        });
        await waitFor(() => expect(onProcessingChange).toHaveBeenLastCalledWith(false));
        expect(onProcessingChange).toHaveBeenCalledTimes(2);
    });

    it("finishes processing without a validation error after unmount", async () => {
        const file = new File(["manual"], "manual.pdf", { type: "application/pdf" });
        const queueValidation = createDeferred();
        validateFiles.mockResolvedValueOnce({ valid: [file], invalid: [] });
        processFiles.mockReturnValueOnce(queueValidation.promise);

        const { unmount } = render(
            <AttachmentContainer keyService="template" allowedFileTypes={[]} multipleFiles deferredUpload />,
        );

        fireEvent.change(screen.getByTestId("file_drop_download"), { target: { files: [file] } });
        await waitFor(() => expect(processFiles).toHaveBeenCalled());
        unmount();

        await act(async () => {
            queueValidation.resolve([file]);
            await queueValidation.promise;
        });

        await waitFor(() => expect(toast.error).not.toHaveBeenCalled());
    });

    it("finishes processing after validation rejects", async () => {
        const file = new File(["manual"], "manual.pdf", { type: "application/pdf" });
        const onProcessingChange = vi.fn();
        validateFiles.mockRejectedValueOnce(new Error("validation failed"));

        render(
            <AttachmentContainer
                keyService="template"
                allowedFileTypes={[]}
                multipleFiles
                deferredUpload
                onProcessingChange={onProcessingChange}
            />,
        );

        fireEvent.change(screen.getByTestId("file_drop_download"), { target: { files: [file] } });

        await waitFor(() => expect(onProcessingChange).toHaveBeenLastCalledWith(false));
        expect(onProcessingChange.mock.calls).toEqual([[true], [false]]);
    });
});
