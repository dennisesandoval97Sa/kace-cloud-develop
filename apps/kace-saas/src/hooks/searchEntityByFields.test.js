import { describe, expect, it, vi } from "vitest";
import { searchEntityByFields } from "./searchEntityByFields";

const RESPONSABLE_CONFIG = {
    url: "/users",
    searchFields: ["nombres", "apellido1", "apellido2"],
    baseFilter: [{ field: "usuarios.deleted_at", operator: "null", value: "null", type: "AND" }],
};

describe("searchEntityByFields - defensive guards", () => {
    it("returns an empty result without calling the backend when selectConfig is null", async () => {
        const search = vi.fn();

        expect(await searchEntityByFields({ selectConfig: null, query: "perez", pageSize: 20, search })).toEqual({
            items: [],
            anyFieldFailed: false,
        });
        expect(search).not.toHaveBeenCalled();
    });

    it("returns an empty result when selectConfig lacks a url (defensive guard against malformed configs)", async () => {
        const search = vi.fn();

        expect(
            await searchEntityByFields({
                selectConfig: { searchFields: ["nombres"] },
                query: "perez",
                pageSize: 20,
                search,
            }),
        ).toEqual({ items: [], anyFieldFailed: false });
        expect(search).not.toHaveBeenCalled();
    });

    it("returns an empty result when searchFields is explicitly empty (no backend call)", async () => {
        const search = vi.fn();

        const { items, anyFieldFailed } = await searchEntityByFields({
            selectConfig: { url: "/users", searchFields: [] },
            query: "perez",
            pageSize: 20,
            search,
        });

        expect(items).toEqual([]);
        expect(anyFieldFailed).toBe(false);
        expect(search).not.toHaveBeenCalled();
    });
});
