import { describe, it, expect } from "vitest";
import { FILTER_DIALOG_CONTENT_CLASS, FILTER_DIALOG_FORM_CLASS } from "./FilterCustomization";

describe("FilterCustomization modal layout contract", () => {
    it("keeps dialog content non-scrolling and viewport-aware", () => {
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/max-w-4xl/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/md:max-w-5xl/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/max-h-\[min\(92vh/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/w-\[calc\(100vw/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/overflow-hidden/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/flex flex-col/);
    });

    it("scrolls the form body inside the dialog shell", () => {
        expect(FILTER_DIALOG_FORM_CLASS).toMatch(/min-h-0/);
        expect(FILTER_DIALOG_FORM_CLASS).toMatch(/flex-1/);
        expect(FILTER_DIALOG_FORM_CLASS).toMatch(/overflow-y-auto/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/overflow-hidden/);
        expect(FILTER_DIALOG_CONTENT_CLASS).not.toMatch(/overflow-y-auto/);
    });
});
