import { describe, it, expect, vi } from "vitest";

vi.mock("@kace/utils", () => ({
    apiService: { post: vi.fn().mockResolvedValue({ data: { data: { items: [] }, metadata: {} } }) },
}));

import { apiService } from "@kace/utils";
import { genericSearchService } from "./genericSearchService";

describe("genericSearchService default pagination", () => {
    it("defaults limit to the backend max page size (100) when no pagination is given", async () => {
        // Arrange
        const url = "https://example.test/cases/search";

        // Act
        await genericSearchService(url, [], null, "cases");

        // Assert
        const [, body] = apiService.post.mock.calls[0];
        expect(body.limit).toBe(100);
    });
});
