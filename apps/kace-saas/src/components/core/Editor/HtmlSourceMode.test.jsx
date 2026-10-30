import { render, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { RichEditor } from "./Editor";

Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture = () => false;

const getUrlS3File = vi.fn();
const downloadFile = vi.fn();

vi.mock("../Attachment/hooks/useAttachmentsS3", () => ({
    default: () => ({ getUrlS3File, downloadFile, deleteFile: vi.fn(), loading: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function makeFile({ name = "logo.png", type = "image/png", size = 1024 } = {}) {
    const file = new File([new Uint8Array(size)], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
}

describe("RichEditor HTML source mode toggle", () => {
    beforeEach(() => {
        getUrlS3File.mockReset();
        downloadFile.mockReset();
        downloadFile.mockResolvedValue("https://bucket.s3.amazonaws.com/presigned-preview");
    });

    it("does not render the source-mode toggle button unless allowHtmlSource is passed (Cases comments / Helps descriptions must stay unaffected)", () => {
        const { queryByTestId } = render(<RichEditor value="<p>Hola mundo</p>" setValue={vi.fn()} name="cuerpo" />);

        expect(queryByTestId("toolbar_toggle_source_cuerpo")).toBeNull();
    });

    it("seeds the source textarea from the editor's current HTML when entering source mode", async () => {
        const { getByTestId } = render(
            <RichEditor value="<p>Hola mundo</p>" setValue={vi.fn()} name="cuerpo" allowHtmlSource />,
        );

        const user = userEvent.setup();
        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));

        await waitFor(() => {
            expect(getByTestId("rich_editor_source_cuerpo")).toBeInTheDocument();
        });
        expect(getByTestId("rich_editor_source_cuerpo").value).toContain("Hola mundo");
    });

    it("parses hand-typed HTML back into real nodes (e.g. <h1>) and syncs the sanitized HTML to Formik", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });
        const user = userEvent.setup();

        const { container, getByTestId } = render(
            <RichEditor value="Hola mundo" setValue={setValue} name="cuerpo" allowHtmlSource />,
        );

        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));

        const textarea = await waitFor(() => getByTestId("rich_editor_source_cuerpo"));
        fireEvent.change(textarea, { target: { value: "<h1>Hola mundo</h1>" } });

        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));

        await waitFor(() => {
            expect(container.querySelector("h1")).not.toBeNull();
        });
        expect(container.querySelector("h1").textContent).toBe("Hola mundo");
        expect(latestHtml).toContain("<h1");
        expect(latestHtml).not.toContain("&lt;h1&gt;");
    });

    /*
     * Regression guard: loadHtmlIntoEditor's own editor.update() marks the tree
     * dirty, which the toolbar's generic 200ms-debounced registerUpdateListener
     * reacts to by re-exporting via $generateHtmlFromNodes and calling setValue
     * again - and that re-export is lossy for hand-authored markup (Lexical's
     * HeadingNode discards inline style on the tag itself and injects the
     * editor's own Tailwind theme classes instead, which mean nothing in the
     * recipient's inbox). Without handleToggleSourceMode's re-assertion after
     * that debounce window, the user's exact authored HTML would be silently
     * replaced a moment after "applying" it.
     */
    it("keeps the user's exact inline style on a heading after the toolbar's debounced re-export fires (regression: sourceMode 'apply' losing styles/gaining dead theme classes)", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });
        const user = userEvent.setup();

        const { getByTestId } = render(
            <RichEditor value="Hola mundo" setValue={setValue} name="cuerpo" allowHtmlSource />,
        );

        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));
        const textarea = await waitFor(() => getByTestId("rich_editor_source_cuerpo"));
        fireEvent.change(textarea, {
            target: { value: '<h1 style="color: rgb(200, 0, 0);">Hola mundo</h1>' },
        });
        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));

        // Wait well past the toolbar's 200ms re-export debounce.
        await new Promise((resolve) => setTimeout(resolve, 400));

        expect(latestHtml).toContain('style="color: rgb(200, 0, 0);"');
        expect(latestHtml).not.toContain("text-2xl");
        expect(latestHtml).not.toContain("font-bold");
    });

    it("keeps the user's exact inline style on a heading when the editor is blurred right after applying the source", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });
        const user = userEvent.setup();

        const { getByTestId } = render(
            <RichEditor value="Hola mundo" setValue={setValue} name="cuerpo" allowHtmlSource />,
        );

        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));
        const textarea = await waitFor(() => getByTestId("rich_editor_source_cuerpo"));
        fireEvent.change(textarea, {
            target: { value: '<h1 style="color: rgb(200, 0, 0);">Hola mundo</h1>' },
        });
        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));
        const input = await waitFor(() => getByTestId("rich_editor_input_cuerpo"));

        fireEvent.blur(input);

        expect(latestHtml).toContain('style="color: rgb(200, 0, 0);"');
        expect(latestHtml).not.toContain("text-2xl");
    });

    it("does not render the insert-image button while in source mode (no manual equivalent - it uploads to S3)", async () => {
        const user = userEvent.setup();
        const { getByTestId, queryByTestId } = render(
            <RichEditor
                value="Hola"
                setValue={vi.fn()}
                name="cuerpo"
                allowHtmlSource
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment: vi.fn() }}
            />,
        );

        expect(queryByTestId("toolbar_insert_image_cuerpo")).not.toBeNull();
        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));
        expect(queryByTestId("toolbar_insert_image_cuerpo")).toBeNull();
    });

    it("keeps a template-attachment image reference intact through an upload (visual) -> source -> visual round trip, without re-editing it", async () => {
        getUrlS3File.mockResolvedValue([{ id: "tmpl-1", fileData: makeFile(), s3Path: "template/tmpl-1/logo.png" }]);
        const saveAttachment = vi.fn().mockResolvedValue();
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });
        const user = userEvent.setup();

        const { getByTestId, container } = render(
            <RichEditor
                value=""
                setValue={setValue}
                name="cuerpo"
                allowHtmlSource
                imageUpload={{ templateId: "tmpl-1", keyService: "template", saveAttachment }}
            />,
        );

        /*
         * Upload happens in visual mode - the toolbar upload button has no
         * manual equivalent (it needs a real S3 round trip), so it's never
         * shown in source mode (see previous test).
         */
        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), { target: { files: [makeFile()] } });
        });
        await waitFor(() => {
            expect(latestHtml).toContain('src="template-attachment://tmpl-1"');
        });
        const htmlAfterUpload = latestHtml;

        /*
         * Entering source mode must show the real template-attachment:// reference
         * as plain text (not the in-memory presigned preview URL, which expires).
         */
        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));
        const textarea = await waitFor(() => getByTestId("rich_editor_source_cuerpo"));
        expect(textarea.value).toContain("template-attachment://tmpl-1");

        /*
         * Applying back without editing must reproduce the exact same HTML and
         * still resolve a working preview (i.e. the node was correctly rebuilt
         * from the template-attachment:// text, not lost).
         */
        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));
        await new Promise((resolve) => setTimeout(resolve, 400));

        expect(latestHtml).toBe(htmlAfterUpload);
        await waitFor(() => {
            expect(
                container.querySelector('img[src="https://bucket.s3.amazonaws.com/presigned-preview"]'),
            ).not.toBeNull();
        });
    });
});
