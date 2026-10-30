import { genericSearchService } from "@/services/genericSearchService";
import { useInfiniteQuery } from "@tanstack/react-query";

const useGenericSearchInfiniteQuery = ({
    keyQuery = "",
    url = "",
    searchById = "",
    filter = [],
    relationship = null,
    table = "",
    useDefault = true,
    staleTime = 0,
    gcTime = 0,
    enabled = true,
    select = null,
    options = {},
    body = null,
    order = null,
    pageSize = null,
}) => {
    const PAGE_SIZE = pageSize || 10;

    const query = useInfiniteQuery({
        queryKey: [keyQuery, searchById || filter],
        queryFn: ({ pageParam = 0 }) =>
            genericSearchService(
                url,
                filter,
                {
                    limit: PAGE_SIZE,
                    offset: pageParam * PAGE_SIZE,
                },
                table,
                useDefault,
                relationship,
                order,
                body,
            ),
        getNextPageParam: (lastPage, allPages) => {
            const totalPages = Math.ceil((lastPage?.total?.count ?? lastPage.total) / PAGE_SIZE);
            const currentPage = allPages.length;

            if (currentPage < totalPages) {
                return currentPage;
            }

            return undefined;
        },
        staleTime,
        gcTime,
        enabled: !!enabled,
        select,
        ...options,
    });

    return { ...query };
};

export default useGenericSearchInfiniteQuery;
