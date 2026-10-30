import { apiService } from "@kace/utils";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const reviewRoute = (id, action, agentScoped) =>
    agentScoped
        ? URL_AND_KEYS.interactions.agent.review(id, action)
        : `${URL_AND_KEYS.interactions.url}/${id}/review/${action}`;

export const claimInteractionReview = (id, { agentScoped = false } = {}) =>
    apiService.post(reviewRoute(id, "claim", agentScoped), {});

export const releaseInteractionReview = (id, { agentScoped = false } = {}) =>
    apiService.post(reviewRoute(id, "release", agentScoped), {});
