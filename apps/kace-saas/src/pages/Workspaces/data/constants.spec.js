import { describe, expect, it } from "vitest";
import { fieldOptions } from "./constants";

describe("Workspace rule field options", () => {
    it("includes the to and body routing fields with i18n label keys", () => {
        expect(fieldOptions).toEqual(
            expect.arrayContaining([
                { value: "to", labelKey: "workspace.rules.fields.to" },
                { value: "body", labelKey: "workspace.rules.fields.body" },
            ]),
        );
    });
});
