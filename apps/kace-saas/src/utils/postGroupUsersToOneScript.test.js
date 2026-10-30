import { describe, it, expect, vi } from "vitest";
import { postGroupUsersToOneScript } from "./postGroupUsersToOneScript.js";

describe("postGroupUsersToOneScript", () => {
    it("posts kaceGroupUsers with payload to target origin", () => {
        const postMessage = vi.fn();
        const contentWindow = { postMessage };
        const users = [{ id: "1", label: "Alice" }];
        const origin = "https://onescript.example.com";

        postGroupUsersToOneScript(contentWindow, users, origin);

        expect(postMessage).toHaveBeenCalledWith({ type: "kaceGroupUsers", payload: users }, origin);
    });

    it("does not post when contentWindow is null", () => {
        expect(() => postGroupUsersToOneScript(null, [], "https://x.com")).not.toThrow();
    });

    it("posts empty array when all users are cleared", () => {
        const postMessage = vi.fn();
        postGroupUsersToOneScript({ postMessage }, [], "https://x.com");
        expect(postMessage).toHaveBeenCalledWith({ type: "kaceGroupUsers", payload: [] }, "https://x.com");
    });
});
