import { beforeEach, describe, expect, it, vi } from "vitest";
import { isContextReferenceBody, prepareDataSee, prepareJsonDataSave } from "./helper";
import { toast } from "sonner";

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
    },
}));

describe("RestEndPoints helper", () => {
    const t = (key) => key;

    beforeEach(() => {
        toast.error.mockClear();
    });

    it("detects whole-body context references", () => {
        expect(isContextReferenceBody("context.channel_hub_tag_request")).toBe(true);
        expect(isContextReferenceBody(" context.channel_hub_tag_request ")).toBe(true);
        expect(isContextReferenceBody("context.channel_hub_tag.items[0]")).toBe(true);
        expect(isContextReferenceBody("context")).toBe(false);
        expect(isContextReferenceBody("context.")).toBe(false);
        expect(isContextReferenceBody("context.channel_hub_tag.")).toBe(false);
        expect(isContextReferenceBody('{"ruleName":"support"}')).toBe(false);
        expect(isContextReferenceBody("channel_hub_tag_request")).toBe(false);
        expect(isContextReferenceBody("context..channel_hub_tag")).toBe(false);
    });

    it("shows a persisted JSON context-reference body as raw text", () => {
        const value = prepareDataSee("body", {
            body_type: "json",
            body: { body: "context.channel_hub_tag_request" },
        });

        expect(value).toBe("context.channel_hub_tag_request");
    });

    it("saves a JSON context-reference body under the body wrapper", () => {
        const values = {
            body_type: "json",
            headers: "{}",
            body: "context.channel_hub_tag_request",
            on_error: "{}",
            on_success: "{}",
            initial_context: "{}",
        };

        expect(prepareJsonDataSave(values, t)).toMatchObject({
            body: { body: "context.channel_hub_tag_request" },
        });
    });

    it("shows a dedicated validation error for an in-progress context-reference body", () => {
        const values = {
            body_type: "json",
            headers: "{}",
            body: "context.",
            on_error: "{}",
            on_success: "{}",
            initial_context: "{}",
        };

        expect(prepareJsonDataSave(values, t)).toBeUndefined();
        expect(toast.error).toHaveBeenCalledWith("restEndPoint.validation.incompleteContextReference");
    });

    it("keeps regular JSON object body behavior", () => {
        const values = {
            body_type: "json",
            headers: "{}",
            body: '{"ruleName":"context.channel_hub_tag.ruleName"}',
            on_error: "{}",
            on_success: "{}",
            initial_context: "{}",
        };

        expect(prepareJsonDataSave(values, t)).toMatchObject({
            body: { body: { ruleName: "context.channel_hub_tag.ruleName" } },
        });
    });
});
