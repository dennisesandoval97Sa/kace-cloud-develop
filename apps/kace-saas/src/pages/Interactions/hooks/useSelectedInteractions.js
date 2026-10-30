import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const SELECTED_INTERACTIONS_QUERY_KEY = ["selectedInteractions"];

export const getSelectedInteractionsKey = (scopeKey = "all") => [...SELECTED_INTERACTIONS_QUERY_KEY, scopeKey ?? "all"];

const useSelectedInteractions = (scopeKey = "all") => {
    const queryClient = useQueryClient();
    const selectedInteractionsKey = useMemo(() => getSelectedInteractionsKey(scopeKey), [scopeKey]);

    const { data: selectedInteractions = [] } = useQuery({
        queryKey: selectedInteractionsKey,
        queryFn: () => [],
        initialData: [],
        staleTime: Infinity,
    });

    useEffect(() => {
        return () => {
            queryClient.setQueriesData({ queryKey: SELECTED_INTERACTIONS_QUERY_KEY }, []);
        };
    }, [queryClient]);

    const setSelectedInteractions = useCallback(
        (updater) => {
            queryClient.setQueryData(selectedInteractionsKey, (prev) => {
                const safePrev = Array.isArray(prev) ? prev : [];
                return typeof updater === "function" ? updater(safePrev) : updater;
            });
        },
        [queryClient, selectedInteractionsKey],
    );

    const clearSelectedInteractions = useCallback(() => {
        queryClient.setQueryData(selectedInteractionsKey, []);
    }, [queryClient, selectedInteractionsKey]);

    const getInteractionFromRow = useCallback((row) => {
        if (row?.original) return row.original;

        return row?.mainRow?.cells?.map((cell) => cell?.content?.props?.row?.original)?.find(Boolean);
    }, []);

    const toggleInteraction = useCallback(
        (row) => {
            const interaction = getInteractionFromRow(row);
            if (!interaction?.id) return;

            setSelectedInteractions((prev) => {
                const exists = prev.some((item) => item.id === interaction.id);
                return exists ? prev.filter((item) => item.id !== interaction.id) : [...prev, interaction];
            });
        },
        [getInteractionFromRow, setSelectedInteractions],
    );

    const toggleAll = useCallback(
        (rows) => {
            setSelectedInteractions((prev) => {
                if (prev.length === rows.length) return [];

                return rows.map(getInteractionFromRow).filter((item) => item?.id);
            });
        },
        [getInteractionFromRow, setSelectedInteractions],
    );

    return {
        selectedInteractions,
        setSelectedInteractions,
        clearSelectedInteractions,
        getInteractionFromRow,
        toggleInteraction,
        toggleAll,
    };
};

export default useSelectedInteractions;
