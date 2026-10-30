import { describe, expect, it, vi } from "vitest";
import { PER_FIELD_SEARCH_LIMIT, searchEntityByFields } from "@/hooks/searchEntityByFields";

const RESPONSABLE_CONFIG = {
    url: "/users",
    searchFields: ["nombres", "apellido1", "apellido2"],
    baseFilter: [{ field: "usuarios.deleted_at", operator: "null", value: "null", type: "AND" }],
};

const user = (id, extra = {}) => ({ id, nombres: id, apellido1: "X", apellido2: "Y", ...extra });

describe("searchEntityByFields", () => {
    it("issues one AND-only ilike search per configured field, each carrying the base filter", async () => {
        const search = vi.fn().mockResolvedValue({ data: [] });

        await searchEntityByFields({ selectConfig: RESPONSABLE_CONFIG, query: "perez", pageSize: 20, search });

        expect(search).toHaveBeenCalledTimes(3);
        for (const [url, filter, pagination] of search.mock.calls) {
            expect(url).toBe("/users/search");
            expect(filter.some((f) => f.groupType || f.type === "OR")).toBe(false);
            expect(filter[0]).toEqual({ field: "usuarios.deleted_at", operator: "null", value: "null", type: "AND" });
            expect(filter[1]).toMatchObject({ operator: "ilike", value: "perez", type: "AND" });
            expect(pagination).toEqual({ limit: PER_FIELD_SEARCH_LIMIT, offset: 0 });
        }
        expect(search.mock.calls.map(([, f]) => f[1].field).sort()).toEqual(["apellido1", "apellido2", "nombres"]);
    });

    it("escapes LIKE metacharacters so they are matched literally", async () => {
        const search = vi.fn().mockResolvedValue({ data: [] });

        await searchEntityByFields({ selectConfig: RESPONSABLE_CONFIG, query: "50%_off", pageSize: 20, search });

        for (const [, filter] of search.mock.calls) {
            expect(filter[1].value).toBe("50\\%\\_off");
        }
    });

    it("merges the per-field results round-robin so the page is not biased towards the first field", async () => {
        const search = vi
            .fn()
            .mockResolvedValueOnce({ data: [user("a"), user("b")] })
            .mockResolvedValueOnce({ data: [user("b"), user("c")] })
            .mockResolvedValueOnce({ data: [user("d")] });

        const { items, anyFieldFailed } = await searchEntityByFields({
            selectConfig: RESPONSABLE_CONFIG,
            query: "x",
            pageSize: 3,
            search,
        });

        expect(items.map((i) => i.id)).toEqual(["a", "b", "d"]);
        expect(anyFieldFailed).toBe(false);
    });

    it("keeps the results that resolved when only one field-search rejects", async () => {
        const search = vi
            .fn()
            .mockResolvedValueOnce({ data: [user("a")] })
            .mockRejectedValueOnce(new Error("network blip"))
            .mockResolvedValueOnce({ data: [user("c")] });

        const { items, anyFieldFailed } = await searchEntityByFields({
            selectConfig: RESPONSABLE_CONFIG,
            query: "x",
            pageSize: 20,
            search,
        });

        expect(items.map((i) => i.id)).toEqual(["a", "c"]);
        expect(anyFieldFailed).toBe(true);
    });

    it("reports total failure when every field-search rejects", async () => {
        const search = vi.fn().mockRejectedValue(new Error("down"));

        const { items, anyFieldFailed } = await searchEntityByFields({
            selectConfig: RESPONSABLE_CONFIG,
            query: "x",
            pageSize: 20,
            search,
        });

        expect(items).toEqual([]);
        expect(anyFieldFailed).toBe(true);
    });

    it("falls back to a single-field search on labelField when searchFields is absent", async () => {
        const search = vi.fn().mockResolvedValue({ data: [] });

        await searchEntityByFields({
            selectConfig: { url: "/states", labelField: "nombre" },
            query: "abierto",
            pageSize: 20,
            search,
        });

        expect(search).toHaveBeenCalledTimes(1);
        expect(search.mock.calls[0][1]).toEqual([
            { field: "nombre", operator: "ilike", value: "abierto", type: "AND" },
        ]);
    });

    it("does not hit the backend for a blank query or a missing config", async () => {
        const search = vi.fn();

        expect(
            await searchEntityByFields({ selectConfig: RESPONSABLE_CONFIG, query: "   ", pageSize: 20, search }),
        ).toEqual({ items: [], anyFieldFailed: false });
        expect(await searchEntityByFields({ selectConfig: null, query: "perez", pageSize: 20, search })).toEqual({
            items: [],
            anyFieldFailed: false,
        });
        expect(search).not.toHaveBeenCalled();
    });
});
