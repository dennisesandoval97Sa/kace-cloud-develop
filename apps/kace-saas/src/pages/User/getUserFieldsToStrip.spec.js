import { describe, expect, it } from "vitest";
import { getUserFieldsToStrip } from "./getUserFieldsToStrip";

describe("getUserFieldsToStrip", () => {
    it("does not strip grupo_activo for SERVICE users (account_type === '2')", () => {
        const fields = getUserFieldsToStrip("2");
        expect(fields).not.toContain("grupo_activo");
    });

    it("does not strip password for SERVICE users (account_type === '2')", () => {
        const fields = getUserFieldsToStrip("2");
        expect(fields).not.toContain("password");
    });

    it("strips password for non-SERVICE users (account_type === '1')", () => {
        const fields = getUserFieldsToStrip("1");
        expect(fields).toContain("password");
    });

    it("strips internal UI fields regardless of account_type", () => {
        const fields = getUserFieldsToStrip("2");
        expect(fields).toEqual(expect.arrayContaining(["groups", "newUser", "filters", "token"]));
    });
});
