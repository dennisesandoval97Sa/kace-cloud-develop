import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@kace/utils";
import { claimInteractionReview, releaseInteractionReview } from "./interactionReviewService";

vi.mock("@kace/utils", () => ({
    apiService: { post: vi.fn() },
}));

describe("interactionReviewService routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps shared administrator review routes unchanged", () => {
        claimInteractionReview("interaction-1");
        releaseInteractionReview("interaction-1");

        expect(apiService.post).toHaveBeenNthCalledWith(1, "/interactions/interaction-1/review/claim", {});
        expect(apiService.post).toHaveBeenNthCalledWith(2, "/interactions/interaction-1/review/release", {});
    });

    it("uses Agent-only review routes when explicitly scoped", () => {
        claimInteractionReview("interaction-1", { agentScoped: true });
        releaseInteractionReview("interaction-1", { agentScoped: true });

        expect(apiService.post).toHaveBeenNthCalledWith(1, "/interactions/agent/interaction-1/review/claim", {});
        expect(apiService.post).toHaveBeenNthCalledWith(2, "/interactions/agent/interaction-1/review/release", {});
    });
});
