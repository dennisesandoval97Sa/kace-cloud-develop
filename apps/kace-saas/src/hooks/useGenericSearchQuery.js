import { useQuery } from "@tanstack/react-query";
import { genericSearchService } from "../services/genericSearchService";

const useGenericSearchQuery = ({
    keyQuery = "",
    url = "",
    searchById = "",
    filter = [],
    relationship = null,
    pagination = null,
    table = "",
    useDefault = true,
    staleTime = 0,
    gcTime = 0,
    enabled = true,
    select = null,
    options = {},
    body = null,
    order = null,
}) => {
    const query = useQuery({
        queryKey: [keyQuery, searchById || filter, pagination],
        queryFn: () =>
            genericSearchService(url, filter, pagination, table, useDefault, relationship, order, body),
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
        fetched: query.fetched,
    };
};

export default useGenericSearchQuery;
