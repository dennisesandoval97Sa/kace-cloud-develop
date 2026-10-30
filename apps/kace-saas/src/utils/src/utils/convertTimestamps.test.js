import { describe, expect, it } from "vitest";
import { convertTimestamps } from "./dateUtils";

describe("convertTimestamps", () => {
    it("keeps the previous space-separated offset format for created_at", () => {
        const result = convertTimestamps({ created_at: "2026-07-15T16:20:56.000Z" });
        expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]/);
        expect(result.created_at).not.toContain("T");
    });

    it("does not throw when nested null values are present", () => {
        expect(() => convertTimestamps({ nested: { created_at: null, child: null } })).not.toThrow();
        expect(convertTimestamps({ nested: { child: null } })).toEqual({ nested: { child: null } });
    });
});
