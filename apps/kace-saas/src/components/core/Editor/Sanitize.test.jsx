import { render, waitFor } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { RichEditor } from "./Editor";

vi.mock("./nodes/TemplateImagePreview", () => ({
    TemplateImagePreview: () => null,
}));

describe("RichEditor HTML sanitization", () => {
    it("strips <script> tags and on* event handlers from a maliciously-crafted initial value", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        render(
            <RichEditor
                value={'<p onclick="alert(1)">Hola</p><script>alert(document.cookie)</script>'}
                setValue={setValue}
                name="cuerpo"
            />,
        );

        await waitFor(() => {
            expect(setValue).toHaveBeenCalled();
        });

        expect(latestHtml).not.toContain("<script");
        expect(latestHtml).not.toContain("onclick");
        expect(latestHtml).not.toContain("alert(");
        expect(latestHtml).toContain("Hola");
    });

    it("preserves template-attachment:// image placeholders while stripping unrelated scripts", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        render(
            <RichEditor
                value={
                    '<img src="template-attachment://tmpl-1" data-filename="logo.png" data-mime="image/png">' +
                    "<script>alert(1)</script>"
                }
                setValue={setValue}
                name="cuerpo"
            />,
        );

        await waitFor(() => {
            expect(setValue).toHaveBeenCalled();
        });

        expect(latestHtml).toContain('src="template-attachment://tmpl-1"');
        expect(latestHtml).not.toContain("<script");
    });
});
