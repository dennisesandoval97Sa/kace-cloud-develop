import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@kace/utils", () => ({
    apiService: { post: vi.fn(), get: vi.fn() },
}));

const { apiService } = await import("@kace/utils");
const { fetchBoardResources, exportBoardResources } = await import("./boards.service");

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

describe("boards.service resources URL", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiService.post.mockResolvedValue({ data: { data: { items: [] } } });
    });

    it("posts resources without active_client when no id is provided", async () => {
        await fetchBoardResources("board-1", 2, { filter: [] });
        expect(apiService.post).toHaveBeenCalledWith("/boards/board-1/resources?page=2", { filter: [] });
    });

    it("appends active_client when an id is provided", async () => {
        await fetchBoardResources("board-1", 1, { filter: [] }, CLIENT_ID);
        expect(apiService.post).toHaveBeenCalledWith(`/boards/board-1/resources?page=1&active_client=${CLIENT_ID}`, {
            filter: [],
        });
    });

    it("appends active_client on export only when present", async () => {
        await exportBoardResources("board-1", { filter: [] }, CLIENT_ID);
        expect(apiService.post).toHaveBeenCalledWith(
            `/boards/board-1/resources?page=1&export=true&active_client=${CLIENT_ID}`,
            { filter: [] },
        );
    });

    it("posts export URL with export=true and without active_client when no id is provided", async () => {
        await exportBoardResources("board-1", { filter: [] });
        expect(apiService.post).toHaveBeenCalledWith("/boards/board-1/resources?page=1&export=true", { filter: [] });
    });
});
