import { beforeEach, describe, expect, it, vi } from "vitest";
import { genericSearchService } from "./genericSearchService";
import { apiService } from "@kace/utils";

vi.mock("@kace/utils", () => ({
    apiService: {
        post: vi.fn(),
    },
}));

describe("genericSearchService", () => {
    beforeEach(() => {
        apiService.post.mockReset();
    });

    it("uses nested metadata.count when the search API returns count as an object", async () => {
        apiService.post.mockResolvedValue({
            data: {
                data: [{ id: 1 }, { id: 2 }],
                metadata: {
                    count: { count: 42 },
                },
            },
        });

        const result = await genericSearchService("/interactions/search", [], { limit: 10, offset: 0 }, null, false);

        expect(result.total).toBe(42);
    });

    it("falls back to the current page length when metadata count is null", async () => {
        apiService.post.mockResolvedValue({
            data: {
                data: [{ id: 1 }, { id: 2 }, { id: 3 }],
                metadata: {
                    count: null,
                },
            },
        });

        const result = await genericSearchService("/interactions/search", [], { limit: 10, offset: 0 }, null, false);

        expect(result.total).toBe(3);
    });
});
