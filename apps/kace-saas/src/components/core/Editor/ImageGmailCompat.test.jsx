import { render, waitFor, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { RichEditor } from "./Editor";

const getUrlS3File = vi.fn();
const downloadFile = vi.fn();
const toastError = vi.fn();

vi.mock("../Attachment/hooks/useAttachmentsS3", () => ({
    default: () => ({ getUrlS3File, downloadFile, deleteFile: vi.fn(), loading: false }),
}));

vi.mock("sonner", () => ({
    toast: { error: (...args) => toastError(...args), success: vi.fn() },
}));

function makeFile({ name, type, size = 1024 } = {}) {
    const file = new File([new Uint8Array(size)], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
}

/*
 * jsdom doesn't implement createImageBitmap/canvas rendering, so these are
 * stubbed to exercise Toolbar.jsx's convertToGmailCompatibleFormat logic
 * end-to-end (real browsers implement both natively). The 4500x3000 (3:2)
 * bitmap simulates a real oversized photo whose aspect ratio maps exactly
 * onto the 300x200 display cap, so the test also proves the downscale step
 * actually runs (canvas ends up at the cap, not native resolution).
 */
function stubCanvasApis() {
    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 4500, height: 3000, close: vi.fn() });
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() });
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
        callback(new Blob([new Uint8Array(10)], { type: "image/jpeg" }));
    };
}

describe("RichEditor image upload — Gmail-incompatible format conversion", () => {
    beforeEach(() => {
        getUrlS3File.mockReset();
        downloadFile.mockReset();
        downloadFile.mockResolvedValue("https://bucket.s3.amazonaws.com/presigned-preview");
        toastError.mockReset();
        stubCanvasApis();
    });

    afterEach(() => {
        delete global.createImageBitmap;
    });

    it("converts a webp upload to a downscaled JPEG before sending it to S3 (Gmail strips data:image/webp inline; PNG at native res risks the 100k content-length cap)", async () => {
        getUrlS3File.mockResolvedValue([
            { id: "tmpl-1", fileData: makeFile({ name: "x.jpg", type: "image/jpeg" }), s3Path: "x" },
        ]);
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

        const file = makeFile({ name: "elefante.webp", type: "image/webp" });
        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), { target: { files: [file] } });
        });

        await waitFor(() => {
            expect(getUrlS3File).toHaveBeenCalled();
        });

        const uploadedFile = getUrlS3File.mock.calls[0][1][0];
        expect(uploadedFile.type).toBe("image/jpeg");
        expect(uploadedFile.name).toMatch(/elefante\.jpg$/);

        await waitFor(() => {
            expect(latestHtml).toContain('data-mime="image/jpeg"');
        });
        expect(latestHtml).not.toContain("image/webp");
        expect(latestHtml).toContain('width="300"');
        expect(latestHtml).toContain('height="200"');
        expect(toastError).not.toHaveBeenCalled();
    });

    it("converts a gif upload to a downscaled JPEG before sending it to S3 (Gmail strips data:image/gif inline)", async () => {
        getUrlS3File.mockResolvedValue([
            { id: "tmpl-1", fileData: makeFile({ name: "x.jpg", type: "image/jpeg" }), s3Path: "x" },
        ]);
        const saveAttachment = vi.fn().mockResolvedValue();

        const { getByTestId } = render(
            <RichEditor
                value=""
                setValue={vi.fn()}
                name="cuerpo"
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment }}
            />,
        );

        const file = makeFile({ name: "banner.gif", type: "image/gif" });
        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), { target: { files: [file] } });
        });

        await waitFor(() => {
            expect(getUrlS3File).toHaveBeenCalled();
        });

        const uploadedFile = getUrlS3File.mock.calls[0][1][0];
        expect(uploadedFile.type).toBe("image/jpeg");
        expect(uploadedFile.name).toMatch(/banner\.jpg$/);
    });

    it("does not touch a jpeg/png upload (already Gmail-compatible), keeping it at native resolution", async () => {
        getUrlS3File.mockResolvedValue([
            { id: "tmpl-1", fileData: makeFile({ name: "logo.png", type: "image/png" }), s3Path: "x" },
        ]);
        const saveAttachment = vi.fn().mockResolvedValue();

        const { getByTestId } = render(
            <RichEditor
                value=""
                setValue={vi.fn()}
                name="cuerpo"
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment }}
            />,
        );

        const file = makeFile({ name: "logo.png", type: "image/png" });
        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), { target: { files: [file] } });
        });

        await waitFor(() => {
            expect(getUrlS3File).toHaveBeenCalled();
        });

        const uploadedFile = getUrlS3File.mock.calls[0][1][0];
        expect(uploadedFile.type).toBe("image/png");
        expect(uploadedFile.name).toMatch(/logo\.png$/);
        /*
         * createImageBitmap should only have been called once, for the dimension read -
         * never for a conversion, since jpeg/png never enters convertToGmailCompatibleFormat's
         * canvas branch.
         */
        expect(global.createImageBitmap).toHaveBeenCalledTimes(1);
    });
});
