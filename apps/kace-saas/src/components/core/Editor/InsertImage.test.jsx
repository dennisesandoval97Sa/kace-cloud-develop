import { render, waitFor, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { RichEditor } from "./Editor";
import i18n from "../../../locale/i18n";

const getUrlS3File = vi.fn();
const downloadFile = vi.fn();
const toastError = vi.fn();

vi.mock("../Attachment/hooks/useAttachmentsS3", () => ({
    default: () => ({ getUrlS3File, downloadFile, deleteFile: vi.fn(), loading: false }),
}));

vi.mock("sonner", () => ({
    toast: { error: (...args) => toastError(...args), success: vi.fn() },
}));

const PNG_MIME = "image/png";

function makeFile({ name = "logo.png", type = PNG_MIME, size = 1024 } = {}) {
    const file = new File([new Uint8Array(size)], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
}

describe("RichEditor image insert flow", () => {
    beforeEach(() => {
        getUrlS3File.mockReset();
        downloadFile.mockReset();
        toastError.mockReset();
        downloadFile.mockResolvedValue("https://bucket.s3.amazonaws.com/presigned-preview");
        vi.stubGlobal("URL", {
            ...URL,
            createObjectURL: vi.fn(() => "blob:local-preview"),
            revokeObjectURL: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("does not render the insert-image button when imageUpload is not provided", () => {
        const { queryByTestId } = render(<RichEditor value="" setValue={vi.fn()} name="cuerpo" />);
        expect(queryByTestId("toolbar_insert_image_cuerpo")).toBeNull();
    });

    it("renders the insert-image button and shows a local blob preview (no upload yet) when imageUpload is missing a templateId (unsaved template)", async () => {
        const saveAttachment = vi.fn();
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId, queryByTestId } = render(
            <RichEditor
                value=""
                setValue={setValue}
                name="cuerpo"
                imageUpload={{ templateId: undefined, keyService: "template", saveAttachment }}
            />,
        );
        expect(queryByTestId("toolbar_insert_image_cuerpo")).not.toBeNull();

        const input = getByTestId("toolbar_insert_image_input_cuerpo");
        await act(async () => {
            fireEvent.change(input, { target: { files: [makeFile()] } });
        });

        expect(getUrlS3File).not.toHaveBeenCalled();
        expect(saveAttachment).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(latestHtml).toContain('src="blob:local-preview"');
        });
        expect(latestHtml).toMatch(/data-filename="[0-9a-f]{8}-logo\.png"/);
        expect(latestHtml).toContain(`data-mime="${PNG_MIME}"`);
    });

    it("uploads the file, saves inline metadata and inserts a template-attachment placeholder", async () => {
        getUrlS3File.mockResolvedValue([{ id: "tmpl-1", fileData: makeFile(), s3Path: "template/tmpl-1/logo.png" }]);
        const saveAttachment = vi.fn().mockResolvedValue();
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId } = render(
            <RichEditor
                value=""
                setValue={setValue}
                name="cuerpo"
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment }}
            />,
        );

        const input = getByTestId("toolbar_insert_image_input_cuerpo");
        const file = makeFile();
        await act(async () => {
            fireEvent.change(input, { target: { files: [file] } });
        });

        await waitFor(() => {
            expect(getUrlS3File).toHaveBeenCalledWith(
                "tmpl-1",
                [expect.objectContaining({ name: expect.stringMatching(/^[0-9a-f]{8}-logo\.png$/) })],
                "template",
            );
        });
        await waitFor(() => {
            expect(saveAttachment).toHaveBeenCalledWith("tmpl-1", [
                expect.objectContaining({ id: "tmpl-1", usageType: "inline" }),
            ]);
        });
        await waitFor(() => {
            expect(latestHtml).toContain('src="template-attachment://tmpl-1"');
        });
        expect(latestHtml).toMatch(/data-filename="[0-9a-f]{8}-logo\.png"/);
        expect(latestHtml).toContain('alt="logo.png"');
        expect(latestHtml).toContain(`data-mime="${PNG_MIME}"`);
    });

    it("accepts a 219KB image (a realistic banner) under the 300KB cap", async () => {
        getUrlS3File.mockResolvedValue([{ id: "tmpl-1", fileData: makeFile(), s3Path: "template/tmpl-1/logo.png" }]);
        const saveAttachment = vi.fn().mockResolvedValue();

        const { getByTestId } = render(
            <RichEditor
                value=""
                setValue={vi.fn()}
                name="cuerpo"
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment }}
            />,
        );

        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), {
                target: { files: [makeFile({ size: 224748 })] },
            });
        });

        await waitFor(() => {
            expect(getUrlS3File).toHaveBeenCalled();
        });
        expect(toastError).not.toHaveBeenCalled();
    });

    it("rejects a file over the size cap without uploading", async () => {
        const saveAttachment = vi.fn();
        const { getByTestId } = render(
            <RichEditor
                value=""
                setValue={vi.fn()}
                name="cuerpo"
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment }}
            />,
        );

        const input = getByTestId("toolbar_insert_image_input_cuerpo");
        fireEvent.change(input, { target: { files: [makeFile({ size: 500 * 1024 })] } });

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(getUrlS3File).not.toHaveBeenCalled();
        expect(saveAttachment).not.toHaveBeenCalled();
    });

    it("shows the backend's real message instead of axios's generic 'Request failed...' when saveAttachment rejects with a response", async () => {
        getUrlS3File.mockResolvedValue([{ id: "tmpl-1", fileData: makeFile(), s3Path: "template/tmpl-1/logo.png" }]);
        const axiosLikeError = new Error("Request failed with status code 400");
        axiosLikeError.response = { data: { message: "This file extension is not allowed" } };
        const saveAttachment = vi.fn().mockRejectedValue(axiosLikeError);

        const { getByTestId } = render(
            <RichEditor
                value=""
                setValue={vi.fn()}
                name="cuerpo"
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment }}
            />,
        );

        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), { target: { files: [makeFile()] } });
        });

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith("This file extension is not allowed");
        });
    });

    it("still translates our own short error codes (e.g. upload_error) via app.alerts", async () => {
        getUrlS3File.mockRejectedValue(new Error("upload_error"));
        const saveAttachment = vi.fn();

        const { getByTestId } = render(
            <RichEditor
                value=""
                setValue={vi.fn()}
                name="cuerpo"
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment }}
            />,
        );

        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), { target: { files: [makeFile()] } });
        });

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith(i18n.t("app.alerts.upload_error"));
        });
    });

    it("shows a delete-image button right after inserting (edit mode) and removes the image on click", async () => {
        getUrlS3File.mockResolvedValue([{ id: "tmpl-1", fileData: makeFile(), s3Path: "template/tmpl-1/logo.png" }]);
        const saveAttachment = vi.fn().mockResolvedValue();
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId, queryByTestId } = render(
            <RichEditor
                value=""
                setValue={setValue}
                name="cuerpo"
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment }}
            />,
        );
        expect(queryByTestId("toolbar_delete_image_cuerpo")).toBeNull();

        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), { target: { files: [makeFile()] } });
        });

        await waitFor(() => {
            expect(latestHtml).toContain("template-attachment://tmpl-1");
        });
        await waitFor(() => {
            expect(getByTestId("toolbar_delete_image_cuerpo")).not.toBeNull();
        });

        await act(async () => {
            fireEvent.click(getByTestId("toolbar_delete_image_cuerpo"));
        });

        await waitFor(() => {
            expect(latestHtml).not.toContain("<img");
        });
        expect(queryByTestId("toolbar_delete_image_cuerpo")).toBeNull();
    });

    it("removes a pending (unsaved-template) local blob preview and revokes its object URL on delete", async () => {
        const saveAttachment = vi.fn();
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId, queryByTestId } = render(
            <RichEditor
                value=""
                setValue={setValue}
                name="cuerpo"
                imageUpload={{ templateId: undefined, keyService: "template", saveAttachment }}
            />,
        );

        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), { target: { files: [makeFile()] } });
        });

        await waitFor(() => {
            expect(latestHtml).toContain("blob:local-preview");
        });
        await waitFor(() => {
            expect(getByTestId("toolbar_delete_image_cuerpo")).not.toBeNull();
        });

        await act(async () => {
            fireEvent.click(getByTestId("toolbar_delete_image_cuerpo"));
        });

        await waitFor(() => {
            expect(latestHtml).not.toContain("<img");
        });
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
        expect(queryByTestId("toolbar_delete_image_cuerpo")).toBeNull();
    });

    it("reloads a saved template-attachment placeholder and resolves a fresh preview URL", async () => {
        downloadFile.mockResolvedValue("https://bucket.s3.amazonaws.com/presigned-preview");
        const html = '<img src="template-attachment://tmpl-1" data-filename="logo.png" data-mime="image/png">';

        const { container } = render(<RichEditor value={html} setValue={vi.fn()} name="cuerpo" />);

        await waitFor(() => {
            expect(downloadFile).toHaveBeenCalledWith(
                "tmpl-1",
                { path: "logo.png", type: "image/png" },
                "template",
                false,
            );
        });
        await waitFor(() => {
            expect(
                container.querySelector('img[src="https://bucket.s3.amazonaws.com/presigned-preview"]'),
            ).not.toBeNull();
        });
    });

    /*
     * Regression guard: the delete-image button only auto-appears for an image just
     * inserted in the current session (see the two tests above). An image already saved
     * on an existing template — loaded fresh on edit, never touched by this session's
     * insert flow — has to be selectable by clicking it directly, or there would be no
     * way at all to remove a pre-existing body image while editing.
     */
    it("lets an already-saved template-attachment image (loaded on edit, not just inserted) be selected by click and deleted", async () => {
        downloadFile.mockResolvedValue("https://bucket.s3.amazonaws.com/presigned-preview");
        const html = '<img src="template-attachment://tmpl-1" data-filename="logo.png" data-mime="image/png">';
        let latestHtml = html;
        const setValue = vi.fn((_name, nextHtml) => {
            latestHtml = nextHtml;
        });

        const { container, getByTestId, queryByTestId } = render(
            <RichEditor
                value={html}
                setValue={setValue}
                name="cuerpo"
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment: vi.fn() }}
            />,
        );

        const img = await waitFor(() => {
            const node = container.querySelector('img[src="https://bucket.s3.amazonaws.com/presigned-preview"]');
            expect(node).not.toBeNull();
            return node;
        });
        expect(queryByTestId("toolbar_delete_image_cuerpo")).toBeNull();

        await act(async () => {
            fireEvent.click(img);
        });
        await waitFor(() => {
            expect(getByTestId("toolbar_delete_image_cuerpo")).not.toBeNull();
        });

        await act(async () => {
            fireEvent.click(getByTestId("toolbar_delete_image_cuerpo"));
        });

        await waitFor(() => {
            expect(latestHtml).not.toContain("<img");
        });
        expect(queryByTestId("toolbar_delete_image_cuerpo")).toBeNull();
    });
});
