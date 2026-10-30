import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { mergeEnsuredSelectOptions } from "@kace_v2/shared/utils/mergeEnsuredSelectOptions.util";
import { resolveSearchTotal } from "@kace_v2/shared/utils/parse-response-api.util";

const DELETED_AT_FILTER = {
    field: "deleted_at",
    operator: "null",
    type: "AND",
    value: "null",
};

const EMPTY_FILTERS = [];
const DEFAULT_ORDER = { direction: "asc", field: "description" };

const toIdList = (initialIds = []) => [
    ...new Set(
        (Array.isArray(initialIds) ? initialIds : [initialIds]).filter(
            (id) => id !== undefined && id !== null && id !== "",
        ),
    ),
];

const mapOptions = (items, mapItem) => (items || []).map(mapItem).filter((option) => option.value !== undefined);

const useSearchableSelectOptions = ({
    queryKey,
    fetchFn,
    mapItem,
    extraFilters = EMPTY_FILTERS,
    searchField,
    initialIds = [],
    pageSize = 50,
    order = DEFAULT_ORDER,
}) => {
    const ensureIds = useMemo(() => toIdList(initialIds), [initialIds]);
    const baseFilter = useMemo(() => [DELETED_AT_FILTER, ...extraFilters], [extraFilters]);

    const { data: ensureData } = useQuery({
        queryKey: [...queryKey, "ensure", ensureIds],
        queryFn: () =>
            fetchFn({
                filter: [DELETED_AT_FILTER, { field: "id", operator: "in", type: "AND", value: ensureIds.join(",") }],
                limit: ensureIds.length,
                offset: 0,
                order,
            }),
        enabled: ensureIds.length > 0,
        staleTime: 0,
        gcTime: 0,
    });

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: [...queryKey, "pages", pageSize, extraFilters, order],
        queryFn: ({ pageParam = 0 }) =>
            fetchFn({
                filter: baseFilter,
                limit: pageSize,
                offset: pageParam * pageSize,
                order,
            }),
        getNextPageParam: ({ total }, allPages) => {
            const totalPages = Math.ceil(resolveSearchTotal(total) / pageSize);
            const currentPage = allPages.length;
            if (currentPage < totalPages) {
                return currentPage;
            }
            return undefined;
        },
        staleTime: 0,
        gcTime: 0,
    });

    const options = useMemo(() => {
        const ensureOptions = mapOptions(ensureData?.data, mapItem);
        const pageOptions = data?.pages
            ? mapOptions(
                  data.pages.flatMap((page) => page.data || []),
                  mapItem,
              )
            : [];
        return mergeEnsuredSelectOptions(ensureOptions, pageOptions);
    }, [data, ensureData, mapItem]);

    const onSearch = useCallback(
        async (searchQuery) => {
            const response = await fetchFn({
                filter: [...baseFilter, { field: searchField, operator: "ilike", type: "AND", value: searchQuery }],
                limit: pageSize,
                offset: 0,
                order,
            });
            return mapOptions(response.data, mapItem);
        },
        [baseFilter, fetchFn, mapItem, order, pageSize, searchField],
    );

    return {
        options,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        onSearch,
    };
};

export default useSearchableSelectOptions;
