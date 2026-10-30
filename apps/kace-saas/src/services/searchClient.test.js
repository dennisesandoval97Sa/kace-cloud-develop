import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./genericSearch", () => ({
    genericSearch: vi.fn(),
}));

const { genericSearch } = await import("./genericSearch");
const { searchClient, searchDescription } = await import("./searchClient");

describe("searchClient id lookups", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        genericSearch.mockResolvedValue({ data: [] });
    });

    it("looks up a client by id with eq", async () => {
        await searchClient("client-uuid");

        expect(genericSearch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                filter: [expect.objectContaining({ field: "id", operator: "eq", value: "client-uuid" })],
            }),
        );
    });

    it("looks up a client description by id with eq", async () => {
        await searchDescription("client-uuid");

        expect(genericSearch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                filter: [expect.objectContaining({ field: "id", operator: "eq", value: "client-uuid" })],
            }),
        );
    });
});
