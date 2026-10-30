import { render, waitFor } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { RichEditor } from "./Editor";

describe("RichEditor backward compatibility with already-saved templates", () => {
    it("loads a pre-fix template whose table cells already have the baked-in 1px border without crashing", async () => {
        const legacyCuerpo =
            '<p class="mb-1" dir="ltr"><span>Prueba plantilla con HTML </span><i><em class="italic">{{cases.reference}}</em></i></p>' +
            '<table class="kace-editor-table"><colgroup><col></col><col></col></colgroup><tbody><tr>' +
            '<td class="kace-editor-table-cell" style="border:1px solid black;width:350px;vertical-align:top;text-align:start">' +
            '<p class="mb-1" dir="ltr"><span>tabla co1</span></p></td>' +
            '<td class="kace-editor-table-cell" style="border:1px solid black;width:350px;vertical-align:top;text-align:start">' +
            '<p class="mb-1" dir="ltr"><span>tabla co2</span></p></td>' +
            "</tr></tbody></table>";

        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { container } = render(<RichEditor value={legacyCuerpo} setValue={setValue} name="cuerpo" />);

        await waitFor(() => {
            expect(container.querySelector("table")).not.toBeNull();
        });

        expect(container.textContent).toContain("tabla co1");
        expect(container.textContent).toContain("tabla co2");
        expect(container.textContent).toContain("{{cases.reference}}");
    });

    it("loads a pre-fix template where a pasted table was saved as escaped literal text without crashing", async () => {
        const legacyEscapedCuerpo =
            '<p class="mb-1" dir="ltr"><span>' +
            "&lt;table&gt;&lt;tbody&gt;&lt;tr&gt;&lt;td&gt;col1&lt;/td&gt;&lt;/tr&gt;&lt;/tbody&gt;&lt;/table&gt;" +
            "</span></p>";

        const { container } = render(<RichEditor value={legacyEscapedCuerpo} setValue={vi.fn()} name="cuerpo" />);

        await waitFor(() => {
            expect(container.querySelector('[data-testid="rich_editor_input_cuerpo"]').textContent).toContain(
                "<table>",
            );
        });

        // Known limitation: data already saved with the old escaping bug has no
        // recoverable structure, so it keeps rendering as literal text (it does
        // not retroactively become a real table) — this only confirms it loads
        // without throwing, same as before.
        expect(container.querySelector("table")).toBeNull();
    });

    it("loads a plain pre-fix template (no tables) with formatting and mustache placeholders unaffected", async () => {
        const legacyCuerpo =
            '<p class="mb-1" dir="ltr"><span>Hola </span><b><strong class="font-bold">{{caso.reference}}</strong></b></p>';

        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { container } = render(<RichEditor value={legacyCuerpo} setValue={setValue} name="cuerpo" />);

        await waitFor(() => {
            expect(container.textContent).toContain("{{caso.reference}}");
        });

        expect(container.querySelector("strong")).not.toBeNull();
    });
});
