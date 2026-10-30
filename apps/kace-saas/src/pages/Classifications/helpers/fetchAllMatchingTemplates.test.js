import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    areAllMatchingSelected,
    clearMatchingFromSelection,
    fetchAllMatchingTemplates,
    mergeSelectedWithMatching,
    sortTemplatesAlphabetically,
    TEMPLATES_ALPHABETICAL_ORDER,
} from "./fetchAllMatchingTemplates";

describe("areAllMatchingSelected", () => {
    it("returns false when there are no matching templates", () => {
        expect(areAllMatchingSelected([{ id: "a" }], [])).toBe(false);
    });

    it("returns true when every matching template is selected", () => {
        expect(areAllMatchingSelected([{ id: "a" }, { id: "b" }, { id: "extra" }], [{ id: "a" }, { id: "b" }])).toBe(
            true,
        );
    });

    it("returns false when any matching template is missing from selection", () => {
        expect(areAllMatchingSelected([{ id: "a" }], [{ id: "a" }, { id: "b" }])).toBe(false);
    });
});

describe("mergeSelectedWithMatching / clearMatchingFromSelection", () => {
    it("keeps previously selected templates outside the matching set when merging", () => {
        expect(
            mergeSelectedWithMatching(
                [{ id: "seed", label: "Seed", value: "Seed" }],
                [
                    { id: "b", label: "Beta", value: "Beta" },
                    { id: "a", label: "Alpha", value: "Alpha" },
                ],
            ),
        ).toEqual([
            { id: "a", label: "Alpha", value: "Alpha" },
            { id: "b", label: "Beta", value: "Beta" },
            { id: "seed", label: "Seed", value: "Seed" },
        ]);
    });

    it("removes only matching templates from the selection", () => {
        expect(
            clearMatchingFromSelection(
                [
                    { id: "seed", label: "Seed", value: "Seed" },
                    { id: "a", label: "Alpha", value: "Alpha" },
                ],
                [{ id: "a", label: "Alpha", value: "Alpha" }],
            ),
        ).toEqual([{ id: "seed", label: "Seed", value: "Seed" }]);
    });
});

describe("sortTemplatesAlphabetically", () => {
    it("orders labels alphabetically with Spanish collation", () => {
        expect(
            sortTemplatesAlphabetically([
                { id: "2", label: "zeta" },
                { id: "1", label: "Águila" },
                { id: "3", label: "beta" },
            ]).map((item) => item.label),
        ).toEqual(["Águila", "beta", "zeta"]);
    });
});

describe("fetchAllMatchingTemplates", () => {
    const search = vi.fn();

    beforeEach(() => {
        search.mockReset();
    });

    it("pages through all active templates when search filter is empty", async () => {
        search
            .mockResolvedValueOnce({
                data: [
                    { id: "t1", descripcion: "One" },
                    { id: "t2", descripcion: "Two" },
                ],
                total: 3,
            })
            .mockResolvedValueOnce({
                data: [{ id: "t3", descripcion: "Three" }],
                total: 3,
            });

        const result = await fetchAllMatchingTemplates({ search, pageSize: 2 });

        expect(result).toEqual([
            { id: "t1", label: "One", value: "One" },
            { id: "t3", label: "Three", value: "Three" },
            { id: "t2", label: "Two", value: "Two" },
        ]);
        expect(search).toHaveBeenNthCalledWith(
            1,
            "/templates/search",
            [{ field: "status", operator: "eq", value: 1, type: "AND" }],
            { limit: 2, offset: 0 },
            null,
            true,
            null,
            TEMPLATES_ALPHABETICAL_ORDER,
        );
        expect(search).toHaveBeenNthCalledWith(
            2,
            "/templates/search",
            [{ field: "status", operator: "eq", value: 1, type: "AND" }],
            { limit: 2, offset: 2 },
            null,
            true,
            null,
            TEMPLATES_ALPHABETICAL_ORDER,
        );
    });

    it("applies the current search filter when fetching all matches", async () => {
        search.mockResolvedValueOnce({
            data: [{ id: "t9", descripcion: "Match" }],
            total: 1,
        });

        await fetchAllMatchingTemplates({ search, searchFilter: "match", pageSize: 100 });

        expect(search).toHaveBeenCalledWith(
            "/templates/search",
            [
                { field: "status", operator: "eq", value: 1, type: "AND" },
                { field: "descripcion", operator: "ilike", value: "match", type: "AND" },
            ],
            { limit: 100, offset: 0 },
            null,
            true,
            null,
            TEMPLATES_ALPHABETICAL_ORDER,
        );
    });
});
