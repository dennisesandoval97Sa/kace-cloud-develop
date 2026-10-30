import { render, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { RichEditor } from "./Editor";

const getUrlS3File = vi.fn();
const downloadFile = vi.fn();

vi.mock("../Attachment/hooks/useAttachmentsS3", () => ({
    default: () => ({ getUrlS3File, downloadFile, deleteFile: vi.fn(), loading: false }),
}));

vi.mock("sonner", () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

function makeFile({ name = "logo.png", type = "image/png", size = 1024 } = {}) {
    const file = new File([new Uint8Array(size)], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
}

/*
 * Template creation has no id yet (see TemplatesForm/TemplatesUpdateHandler), so
 * imageUpload.templateId is undefined and inserted images fall back to a local blob
 * preview. This exercises every body-editing feature together in that exact state —
 * table insert/delete, image insert/delete, and the </> HTML source toggle — to make
 * sure none of them block or corrupt one another while the template doesn't exist yet.
 */
describe("RichEditor body toolbar — template creation (no templateId yet)", () => {
    beforeEach(() => {
        getUrlS3File.mockReset();
        downloadFile.mockReset();
        vi.stubGlobal("URL", {
            ...URL,
            createObjectURL: vi.fn(() => "blob:local-preview"),
            revokeObjectURL: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("supports insert table, delete table, insert image, delete image and the HTML source toggle together, in sequence", async () => {
        const saveAttachment = vi.fn();
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });
        const user = userEvent.setup();

        const { getByTestId, queryByTestId } = render(
            <RichEditor
                value=""
                setValue={setValue}
                name="cuerpo"
                imageUpload={{ templateId: undefined, keyService: "template", saveAttachment }}
                allowHtmlSource
            />,
        );

        // 1) Insert a table.
        await act(async () => {
            fireEvent.click(getByTestId("toolbar_insert_table_cuerpo"));
        });
        await waitFor(() => expect(latestHtml).toContain("<table"));

        // 2) Delete it — must not be blocked by imageUpload being in "no id yet" mode.
        await waitFor(() => expect(getByTestId("toolbar_delete_table_cuerpo")).not.toBeNull());
        await act(async () => {
            fireEvent.click(getByTestId("toolbar_delete_table_cuerpo"));
        });
        await waitFor(() => expect(latestHtml).not.toContain("<table"));

        /*
         * 3) Insert an image (local blob preview, no upload yet). Inserting selects it, so
         * the delete-image button is immediately available — delete it right away.
         */
        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), {
                target: { files: [makeFile()] },
            });
        });
        await waitFor(() => expect(latestHtml).toContain("blob:local-preview"));
        expect(getUrlS3File).not.toHaveBeenCalled();
        expect(saveAttachment).not.toHaveBeenCalled();

        await waitFor(() => expect(getByTestId("toolbar_delete_image_cuerpo")).not.toBeNull());
        await act(async () => {
            fireEvent.click(getByTestId("toolbar_delete_image_cuerpo"));
        });
        await waitFor(() => expect(latestHtml).not.toContain("<img"));
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
        expect(queryByTestId("toolbar_delete_image_cuerpo")).toBeNull();

        // 4) A table insert/delete must still work fine after that image was inserted and removed.
        await act(async () => {
            fireEvent.click(getByTestId("toolbar_insert_table_cuerpo"));
        });
        await waitFor(() => expect(latestHtml).toContain("<table"));
        await act(async () => {
            fireEvent.click(getByTestId("toolbar_delete_table_cuerpo"));
        });
        await waitFor(() => expect(latestHtml).not.toContain("<table"));
        expect(latestHtml).not.toContain("<img");

        // 5) Insert it again to confirm the feature still works after a table insert/delete cycle.
        await act(async () => {
            fireEvent.change(getByTestId("toolbar_insert_image_input_cuerpo"), {
                target: { files: [makeFile({ name: "banner.png" })] },
            });
        });
        await waitFor(() => expect(latestHtml).toContain("blob:local-preview"));

        /*
         * 6) Toggle into </> source mode — the pending image markup must survive the round trip,
         * and the table/image toolbar controls hide while in source mode (no manual equivalent).
         */
        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));
        const textarea = await waitFor(() => getByTestId("rich_editor_source_cuerpo"));
        expect(textarea.value).toContain("blob:local-preview");
        expect(queryByTestId("toolbar_insert_table_cuerpo")).toBeNull();
        expect(queryByTestId("toolbar_insert_image_cuerpo")).toBeNull();

        // 7) Toggle back to the WYSIWYG view and confirm the table/image controls return, usable.
        await user.click(getByTestId("toolbar_toggle_source_cuerpo"));
        await waitFor(() => expect(getByTestId("toolbar_insert_table_cuerpo")).not.toBeNull());
        expect(getByTestId("toolbar_insert_image_input_cuerpo")).not.toBeNull();
        expect(latestHtml).toContain("blob:local-preview");

        await act(async () => {
            fireEvent.click(getByTestId("toolbar_insert_table_cuerpo"));
        });
        await waitFor(() => expect(latestHtml).toContain("<table"));
    });
});
