import { useInfiniteQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchGroups } from "@kace_v2/shared/services/groups.service";
import { useCallback, useEffect, useMemo, useState } from "react";

const arraysEqual = (a, b) => {
    const left = a ?? [];
    const right = b ?? [];

    return left.length === right.length && left.every((value, index) => value === right[index]);
};

const useGroupsOptions = (initialGroups = [], pageSize = 100, { enabled = true } = {}) => {
    const [groups, setGroups] = useState([]);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: QUERY_KEYS.GROUPS.ROOT,
        queryFn: ({ pageParam = 0 }) =>
            fetchGroups({
                filter: [
                    {
                        field: "deleted_at",
                        operator: "null",
                        type: "AND",
                        value: "null",
                    },
                    {
                        field: "status",
                        operator: "eq",
                        type: "AND",
                        value: 1,
                    },
                ],
                limit: pageSize,
                offset: pageParam * pageSize,
            }),
        getNextPageParam: ({ count, total }, allPages) => {
            const totalPages = Math.ceil(total / pageSize);
            const currentPage = allPages.length;

            if (currentPage < totalPages) {
                return currentPage;
            }

            return undefined;
        },
        staleTime: 0,
        gcTime: 0,
        enabled,
    });

    const groupsOptions = useMemo(() => {
        if (!data?.pages) return [];

        return data.pages
            .flatMap((page) => page.data || [])
            .map((item) => ({
                label: item.nombre,
                value: item.id,
            }))
            .filter((option) => option.value !== undefined);
    }, [data]);

    const onSearch = useCallback(
        async (searchQuery) => {
            const response = await fetchGroups({
                filter: [
                    {
                        field: "deleted_at",
                        operator: "null",
                        type: "AND",
                        value: "null",
                    },
                    {
                        field: "status",
                        operator: "eq",
                        type: "AND",
                        value: 1,
                    },
                    {
                        field: "nombre",
                        operator: "ilike",
                        type: "AND",
                        value: searchQuery,
                    },
                ],
                limit: pageSize,
                offset: 0,
            });

            return (response.data || [])
                .map((item) => ({
                    label: item.nombre,
                    value: item.id,
                }))
                .filter((option) => option.value !== undefined);
        },
        [pageSize],
    );

    useEffect(() => {
        setGroups((prev) => (arraysEqual(prev, initialGroups) ? prev : initialGroups));
    }, [initialGroups]);

    return {
        groups,
        setGroups,
        groupsOptions,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        onSearch,
    };
};

export default useGroupsOptions;
