import { render, waitFor, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { RichEditor } from "./Editor";

describe("RichEditor table insert flow", () => {
    it("saves a freshly inserted table without the editor-only border or theme classes", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId } = render(<RichEditor value="" setValue={setValue} name="cuerpo" />);

        await act(async () => {
            fireEvent.click(getByTestId("toolbar_insert_table_cuerpo"));
        });

        await waitFor(() => {
            expect(latestHtml).toContain("<table");
        });

        expect(latestHtml).not.toContain("kace-editor-table");
        expect(latestHtml).not.toContain("border:1px solid black");
        expect(latestHtml).not.toContain("border: 1px solid black");
    });

    it("keeps a real HTML table's own style/border verbatim through a load+edit round trip", async () => {
        const sourceHtml =
            '<table style="border-collapse:collapse;width:100%" border="0">' +
            '<colgroup><col style="width:25%"><col style="width:75%"></colgroup>' +
            "<tbody><tr>" +
            '<td style="vertical-align:top">col1</td>' +
            '<td style="vertical-align:top">col2</td>' +
            "</tr></tbody></table>";

        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { container } = render(<RichEditor value={sourceHtml} setValue={setValue} name="cuerpo" />);

        await waitFor(() => {
            expect(container.querySelector("table")).not.toBeNull();
        });

        // Force a dirty update so the toolbar's sanitize/sync listener runs and
        // captures the currently-loaded table back into exported HTML.
        await act(async () => {
            container.querySelector('[contenteditable="true"]').focus();
            fireEvent.input(container.querySelector('[contenteditable="true"]'));
        });

        await waitFor(() => {
            expect(latestHtml).toContain("<table");
        });

        expect(latestHtml).toContain('style="border-collapse:collapse;width:100%"');
        expect(latestHtml).toContain('border="0"');
        expect(latestHtml).toContain('style="vertical-align:top"');
    });
});
