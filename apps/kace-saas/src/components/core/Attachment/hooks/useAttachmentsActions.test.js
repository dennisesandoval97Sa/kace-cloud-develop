import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAttachmentsActions from "./useAttachmentsActions";

const mocks = vi.hoisted(() => ({
    deleteFile: vi.fn(),
    downloadFile: vi.fn(),
    getUrlS3File: vi.fn(),
}));

vi.mock("@kace/plugins", () => ({
    Uuid: () => "pending-attachment-id",
}));

vi.mock("./useAttachmentsS3", () => ({
    default: () => mocks,
}));

const renderAttachmentsActions = (overrides = {}) => {
    const props = {
        currentListAttachments: [],
        keyService: "helps",
        attachmentService: "/helps_attachments",
        attachmentId: "server-help-id",
        allowedFileTypes: [],
        multipleFiles: true,
        handleFiles: vi.fn(),
        saveAttachments: vi.fn(),
        disabled: false,
        deferredUpload: true,
        ...overrides,
    };

    return { props, ...renderHook(() => useAttachmentsActions(props)) };
};

describe("useAttachmentsActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps selected files pending without uploading in deferred mode", async () => {
        const file = new File(["plain help content"], "guide.txt", { type: "text/plain" });
        const { props, result } = renderAttachmentsActions();

        await act(async () => {
            await result.current.handleUpload([file]);
        });

        expect(mocks.getUrlS3File).not.toHaveBeenCalled();
        expect(props.saveAttachments).not.toHaveBeenCalled();
        expect(props.handleFiles).toHaveBeenCalledWith([
            expect.objectContaining({
                id: "pending-attachment-id",
                path: "guide.txt",
                tipo: "text/plain",
                fileData: file,
                status: "pending",
            }),
        ]);
    });

    it("keeps immediate uploads for persisted resources", async () => {
        const file = new File(["persisted help content"], "persisted.txt", { type: "text/plain" });
        const uploadedFile = { id: "server-help-id", fileData: file };
        const savedAttachment = { id: "server-attachment-id", path: "persisted.txt" };
        mocks.getUrlS3File.mockResolvedValue([uploadedFile]);
        const saveAttachments = vi.fn().mockResolvedValue([savedAttachment]);
        const { props, result } = renderAttachmentsActions({ deferredUpload: false, saveAttachments });

        await act(async () => {
            await result.current.handleUpload([file]);
        });

        expect(mocks.getUrlS3File).toHaveBeenCalledWith("server-help-id", [file], "helps");
        expect(saveAttachments).toHaveBeenCalledWith("server-help-id", [uploadedFile]);
        expect(props.handleFiles).toHaveBeenCalledWith([savedAttachment]);
    });

    it("deletes a persisted success through the attachment endpoint in deferred mode", async () => {
        const successfulAttachment = {
            id: "server-attachment-id",
            path: "persisted.txt",
            status: "success",
        };
        mocks.deleteFile.mockResolvedValue(true);
        const { props, result } = renderAttachmentsActions({
            currentListAttachments: [successfulAttachment],
        });

        await act(async () => {
            await result.current.handleDelete(successfulAttachment.id, successfulAttachment);
        });

        expect(mocks.deleteFile).toHaveBeenCalledWith("server-attachment-id", "/helps_attachments");
        expect(props.handleFiles).toHaveBeenCalledWith([]);
    });

    it.each(["pending", "failed"])("removes a %s deferred attachment locally", async (status) => {
        const localAttachment = {
            id: `${status}-attachment-id`,
            path: `${status}.txt`,
            status,
        };
        const { props, result } = renderAttachmentsActions({
            currentListAttachments: [localAttachment],
        });

        await act(async () => {
            await result.current.handleDelete(localAttachment.id, localAttachment);
        });

        expect(mocks.deleteFile).not.toHaveBeenCalled();
        expect(props.handleFiles).toHaveBeenCalledWith([]);
    });

    it("synchronizes local state when the parent clears the attachment list", () => {
        const initialAttachment = {
            id: "persisted-attachment-id",
            path: "persisted.txt",
            status: "success",
        };
        const props = {
            keyService: "helps",
            attachmentService: "/helps_attachments",
            attachmentId: "server-help-id",
            allowedFileTypes: [],
            multipleFiles: true,
            handleFiles: vi.fn(),
            saveAttachments: vi.fn(),
            disabled: false,
            deferredUpload: true,
        };
        const { result, rerender } = renderHook(
            ({ currentListAttachments }) => useAttachmentsActions({ ...props, currentListAttachments }),
            { initialProps: { currentListAttachments: [initialAttachment] } },
        );

        expect(result.current.listAttachment).toEqual([initialAttachment]);

        rerender({ currentListAttachments: [] });

        expect(result.current.listAttachment).toEqual([]);
    });

    describe("allowedExtensions policy", () => {
        it("returns an empty list when tenant config has no overlap with route types", () => {
            const { result } = renderAttachmentsActions({
                allowedFileExtensions: [".pdf", ".png"],
                allowedFileTypes: ["csv"],
            });

            expect(result.current.allowedExtensions).toEqual([]);
        });

        it("returns the intersection when tenant config and route types overlap", () => {
            const { result } = renderAttachmentsActions({
                allowedFileExtensions: [".pdf", ".png", ".csv"],
                allowedFileTypes: ["csv"],
            });

            expect(result.current.allowedExtensions).toEqual([".csv"]);
        });

        it("returns an empty list when tenant config is empty and opt-out is not enabled", () => {
            const { result } = renderAttachmentsActions({
                allowedFileExtensions: [],
                allowedFileTypes: ["csv"],
            });

            expect(result.current.allowedExtensions).toEqual([]);
        });

        it("uses tenant configured extensions when route defines no specific types", () => {
            const { result } = renderAttachmentsActions({
                allowedFileExtensions: [".pdf", ".png"],
                allowedFileTypes: [],
            });

            expect(result.current.allowedExtensions).toEqual([".pdf", ".png"]);
        });

        it("returns an empty list when tenant config is empty and route defines no restrictions", () => {
            const { result } = renderAttachmentsActions({
                allowedFileExtensions: [],
                allowedFileTypes: [],
            });

            expect(result.current.allowedExtensions).toEqual([]);
        });

        it("uses route allowed extensions when ignoreTenantExtensions is true regardless of tenant config", () => {
            const { result } = renderAttachmentsActions({
                allowedFileExtensions: [".pdf", ".png"],
                allowedFileTypes: ["csv"],
                ignoreTenantExtensions: true,
            });

            expect(result.current.allowedExtensions).toEqual([".csv"]);
        });

        it("uses route allowed extensions when ignoreTenantExtensions is true and tenant config is empty", () => {
            const { result } = renderAttachmentsActions({
                allowedFileExtensions: [],
                allowedFileTypes: ["csv"],
                ignoreTenantExtensions: true,
            });

            expect(result.current.allowedExtensions).toEqual([".csv"]);
        });

        it.each([
            {
                description: "empty tenant extensions ([])",
                tenantExtensions: [],
                routeTypes: ["images"],
                expected: [],
            },
            {
                description: "no overlap between tenant and route",
                tenantExtensions: [".pdf"],
                routeTypes: ["images"],
                expected: [],
            },
            {
                description: "partial overlap between tenant and route",
                tenantExtensions: [".pdf", ".png"],
                routeTypes: ["images"],
                expected: [".png"],
            },
            {
                description: "empty tenant extensions ([]) with generic route ([])",
                tenantExtensions: [],
                routeTypes: [],
                expected: [],
            },
        ])(
            "enforces strict backend semantics without opt-out for $description",
            ({ tenantExtensions, routeTypes, expected }) => {
                const { result } = renderAttachmentsActions({
                    allowedFileExtensions: tenantExtensions,
                    allowedFileTypes: routeTypes,
                });

                expect(result.current.allowedExtensions).toEqual(expected);
            },
        );
    });
});
