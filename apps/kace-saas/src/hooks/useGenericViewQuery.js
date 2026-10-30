import { useQuery } from "@tanstack/react-query";
import { genericView } from "../services/genericView";

const useGenericViewQuery = ({
    keyQuery = "",
    url = "",
    searchById = [],
    staleTime = 0,
    gcTime = 0,
    enabled = true,
    options = {},
}) => {
    const query = useQuery({
        queryKey: [keyQuery, searchById],
        queryFn: async () => genericView(url),
        staleTime,
        gcTime,
        enabled: !!enabled,
        select: (data) => data.items || data,
        ...options,
    });
    return {
        data: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
        isError: query.isError,
        status: query.status,
        isFetching: query.isFetching,
        isFetched: query.isFetched,
    };
};

export default useGenericViewQuery;
