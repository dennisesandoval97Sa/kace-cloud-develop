import { useQuery } from "@tanstack/react-query";
import { genericView } from "@/services/genericView";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const normalizeItems = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (raw?.data && Array.isArray(raw.data)) return raw.data;
    if (raw?.items && Array.isArray(raw.items)) return raw.items;
    return [];
};

const buildQueryKey = (caseId) => ["case-available-states", "board-bulk", caseId];

const fetchTransitions = async (caseId) => {
    const raw = await genericView(`${URL_AND_KEYS.cases.urlCaseAvailableStates}/${caseId}`);
    return normalizeItems(raw);
};

const STALE_TIME_MS = 60 * 1000;

export const prefetchCaseAvailableTransitionsOptions = (queryClient, caseId) => {
    if (!caseId) return Promise.resolve();
    return queryClient.prefetchQuery({
        queryKey: buildQueryKey(caseId),
        queryFn: () => fetchTransitions(caseId),
        staleTime: STALE_TIME_MS,
    });
};

const useCaseAvailableTransitionsOptions = (caseId) => {
    return useQuery({
        queryKey: buildQueryKey(caseId),
        queryFn: () => fetchTransitions(caseId),
        enabled: Boolean(caseId),
        select: (items) =>
            items
                .map((item) => ({
                    label: item.estado_siguiente?.nombre ?? "—",
                    value: item.transition?.id != null ? String(item.transition.id) : "",
                }))
                .filter((o) => o.value !== ""),
        staleTime: STALE_TIME_MS,
    });
};

export default useCaseAvailableTransitionsOptions;
