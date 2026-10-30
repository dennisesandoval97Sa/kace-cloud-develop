import { fetchAvailableBoards } from "@kace_v2/features/boards/services/boards.service";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";

const processBoards = (data) => {
    const items = data?.data?.items || data?.data || [];
    if (items.length && Array.isArray(items)) {
        return items.map((board) => ({
            id: board.id,
            name: board.name,
            icon_class: board.icon_class,
        }));
    }

    return [];
};

const useAvailableBoards = () => {
    const query = useQuery({
        queryKey: QUERY_KEYS.BOARDS.AVAILABLE,
        queryFn: fetchAvailableBoards,
        select: processBoards,
        staleTime: 0,
        gcTime: 0,
    });

    return {
        boards: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
    };
};

export default useAvailableBoards;
