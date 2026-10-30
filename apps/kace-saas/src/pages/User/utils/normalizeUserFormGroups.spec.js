import { describe, expect, it } from "vitest";
import {
    getSelectedGroupIds,
    resolveActiveGroupForSelectedGroups,
    shouldRequireGroups,
} from "./normalizeUserFormGroups";

describe("normalizeUserFormGroups", () => {
    it("collects selected group ids and ignores empty values", () => {
        expect(getSelectedGroupIds([{ id: "group-a" }, { id: "" }, { id: "group-b" }])).toEqual(["group-a", "group-b"]);
    });

    it("requires groups only when creating a user", () => {
        expect(shouldRequireGroups({})).toBe(true);
        expect(shouldRequireGroups({ id: "user-id" })).toBe(false);
    });

    it("keeps an active group that is still selected", () => {
        expect(resolveActiveGroupForSelectedGroups("group-a", ["group-a", "group-b"])).toBe("group-a");
    });

    it("moves a stale active group to the first selected group", () => {
        expect(resolveActiveGroupForSelectedGroups("removed-group", ["group-a", "group-b"])).toBe("group-a");
    });
});
