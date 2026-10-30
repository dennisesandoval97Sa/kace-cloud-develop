import { useQuery } from "@tanstack/react-query";
import { apiService } from "@kace/utils";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const emptyLinkedCases = { caseIds: [], items: [] };

const normalizeLinkedCasesResponse = (response) => {
    const payload = response?.data?.data ?? response?.data ?? {};
    return {
        caseIds: payload.case_ids ?? payload.caseIds ?? [],
        items: payload.items ?? [],
    };
};

export const useLinkedInteractionCases = (interactionId, { enabled = true, activeGroupId } = {}) => {
    const query = useQuery({
        queryKey: ["linked-interaction-cases", activeGroupId, interactionId],
        queryFn: async () => {
            const response = await apiService.get(`${URL_AND_KEYS.interactions.agent.associate}/${interactionId}`);
            return normalizeLinkedCasesResponse(response);
        },
        enabled: Boolean(enabled && activeGroupId && interactionId),
        staleTime: 30 * 1000,
    });

    return {
        ...query,
        caseIds: query.data?.caseIds ?? emptyLinkedCases.caseIds,
        items: query.data?.items ?? emptyLinkedCases.items,
    };
};
