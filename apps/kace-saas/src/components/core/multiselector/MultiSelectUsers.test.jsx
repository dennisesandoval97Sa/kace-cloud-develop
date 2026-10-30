import { describe, it, expect, vi } from "vitest";
import { notifyUserSelectionChange } from "./notifyUserSelectionChange.js";

describe("notifyUserSelectionChange", () => {
    it("updates list values and notifies parent on user selection", () => {
        const setListValues = vi.fn();
        const onUserSelectionChange = vi.fn();
        const next = [{ id: "2", label: "Bob" }];

        notifyUserSelectionChange(setListValues, onUserSelectionChange, next, []);

        expect(setListValues).toHaveBeenCalledWith(next);
        expect(onUserSelectionChange).toHaveBeenCalledWith(next);
    });

    it("resolves functional updaters before notifying parent", () => {
        const setListValues = vi.fn();
        const onUserSelectionChange = vi.fn();
        const currentList = [{ id: "1", label: "Alice" }];
        const next = (prev) => [...prev, { id: "2", label: "Bob" }];

        notifyUserSelectionChange(setListValues, onUserSelectionChange, next, currentList);

        expect(setListValues).toHaveBeenCalledWith(next);
        expect(onUserSelectionChange).toHaveBeenCalledWith([
            { id: "1", label: "Alice" },
            { id: "2", label: "Bob" },
        ]);
    });

    it("updates list values when onUserSelectionChange is omitted", () => {
        const setListValues = vi.fn();
        const next = [];

        expect(() => notifyUserSelectionChange(setListValues, undefined, next, [])).not.toThrow();
        expect(setListValues).toHaveBeenCalledWith(next);
    });
});
