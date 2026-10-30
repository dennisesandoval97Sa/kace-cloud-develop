import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

const SELECTED_CASES_KEY = ["selectedCases"];

const useSelectedCases = () => {
    const queryClient = useQueryClient();

    const { data: selectedCases = [] } = useQuery({
        queryKey: SELECTED_CASES_KEY,
        queryFn: () => [],
        staleTime: Infinity,
    });

    const setSelectedCases = (updater) => {
        queryClient.setQueryData(SELECTED_CASES_KEY, (prev) => {
            const safePrev = Array.isArray(prev) ? prev : [];
            return typeof updater === "function"
                ? updater(safePrev)
                : updater;
        });
    };

    const clearSelectedCases = () => {
        queryClient.setQueryData(SELECTED_CASES_KEY, []);
    };

    const getCaseFromRow = useCallback((row) => {
        return row?.mainRow?.cells
            ?.map(cell => cell?.content?.props?.row?.original)
            ?.find(Boolean);
    }, []);

    const toggleCase = useCallback((row) => {
        const caseData = getCaseFromRow(row);
        if (!caseData?.id) return;

        setSelectedCases(prev => {
            const exists = prev.some(item => item.id === caseData.id);
            return exists
                ? prev.filter(item => item.id !== caseData.id)
                : [...prev, caseData];
        });
    }, [getCaseFromRow]);

    const toggleAll = useCallback((rows) => {
        setSelectedCases(prev => {
            if (prev.length === rows.length) return [];

            return rows
                .map(getCaseFromRow)
                .filter(item => item?.id);
        });
    }, [getCaseFromRow]);

    return {
        selectedCases,
        setSelectedCases,
        clearSelectedCases,
        getCaseFromRow,
        toggleCase,
        toggleAll,
    };
};

export default useSelectedCases;
