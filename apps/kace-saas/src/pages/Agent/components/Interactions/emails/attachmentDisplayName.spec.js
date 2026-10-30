import { describe, expect, it } from "vitest";
import { getAttachmentDisplayName } from "./attachmentDisplayName";

describe("getAttachmentDisplayName", () => {
    it("prefers filename over legacy name", () => {
        expect(getAttachmentDisplayName({ filename: "invoice.pdf", name: "legacy.pdf" })).toBe("invoice.pdf");
    });

    it("falls back to name and then attachment", () => {
        expect(getAttachmentDisplayName({ name: "legacy.pdf" })).toBe("legacy.pdf");
        expect(getAttachmentDisplayName({})).toBe("attachment");
    });

    it("canonicalizes unsafe path-like filenames", () => {
        expect(getAttachmentDisplayName({ filename: "../../evil.pdf" })).toBe("evil.pdf");
        expect(getAttachmentDisplayName({ filename: "C:\\temp\\invoice?.pdf" })).toBe("invoice.pdf");
    });

    it("falls back when filename only contains unsafe characters", () => {
        expect(getAttachmentDisplayName({ filename: "\u0000   ..   " })).toBe("attachment");
    });
});
