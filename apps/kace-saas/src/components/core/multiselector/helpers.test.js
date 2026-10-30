import { describe, it, expect } from "vitest";
import { buildDisplayUsers } from "./helpers";

const user = (id) => ({ id, label: `User ${id}`, value: `User ${id}` });

describe("buildDisplayUsers", () => {
    const catalog = [user("a"), user("b"), user("c"), user("d")];

    it("groups selected users first when groupSelectedFirst is true (default)", () => {
        const result = buildDisplayUsers(catalog, [user("c"), user("z")], {});
        expect(result.map((u) => u.id)).toEqual(["z", "c", "a", "b", "d"]);
    });

    it("keeps the API catalog order when groupSelectedFirst is false", () => {
        const result = buildDisplayUsers(catalog, [user("c"), user("a")], { groupSelectedFirst: false });
        expect(result.map((u) => u.id)).toEqual(["a", "b", "c", "d"]);
    });

    it("appends selected users missing from the catalog at the end in browse mode", () => {
        const result = buildDisplayUsers(catalog, [user("b"), user("z")], { groupSelectedFirst: false });
        expect(result.map((u) => u.id)).toEqual(["a", "b", "c", "d", "z"]);
    });

    it("does not drag non-matching selected users into an active search", () => {
        const result = buildDisplayUsers([user("a")], [user("z")], {
            groupSelectedFirst: false,
            hasSearched: true,
        });
        expect(result.map((u) => u.id)).toEqual(["a"]);
    });

    it("returns the selected list as a placeholder while a search request is in flight", () => {
        const result = buildDisplayUsers([], [user("z")], {
            groupSelectedFirst: false,
            hasSearched: true,
            isFetching: true,
        });
        expect(result.map((u) => u.id)).toEqual(["z"]);
    });
});
