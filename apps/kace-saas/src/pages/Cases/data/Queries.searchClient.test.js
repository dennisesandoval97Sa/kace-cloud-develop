import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/genericSearch", () => ({
    genericSearch: vi.fn(),
}));
vi.mock("../../../services/genericView", () => ({
    genericView: vi.fn(),
}));
vi.mock("@kace/utils", async (importOriginal) => ({
    ...(await importOriginal()),
    apiService: { post: vi.fn(), get: vi.fn() },
}));

const { genericSearch } = await import("../../../services/genericSearch");
const { searchClient, searchDescription } = await import("./Queries");

describe("Cases Queries client id lookups", () => {
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
