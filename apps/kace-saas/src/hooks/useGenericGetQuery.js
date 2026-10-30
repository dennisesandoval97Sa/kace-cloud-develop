import { useQuery } from "@tanstack/react-query";
import { apiService } from "@kace/utils";

/**
 * Hook para realizar peticiones GET simples sin payload
 * Útil para endpoints que solo requieren parámetros en la URL
 */
const useGenericGetQuery = ({
    keyQuery = "",
    url = "",
    staleTime = 0,
    gcTime = 0,
    enabled = true,
    select = null,
    options = {},
}) => {
    const query = useQuery({
        queryKey: [keyQuery],
        queryFn: async () => {
            const response = await apiService.get(url);
            return response;
        },
        staleTime,
        gcTime,
        enabled: !!enabled,
        select,
        ...options,
    });

    return {
        data: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
        status: query.status,
        isFetching: query.isFetching,
        isError: query.isError,
        isFetched: query.isFetched,
    };
};

export default useGenericGetQuery;
