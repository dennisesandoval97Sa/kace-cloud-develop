import { useInfiniteQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchUsers } from "@kace_v2/shared/services/users.service";
import { useCallback, useEffect, useMemo, useState } from "react";

const arraysEqual = (a, b) => {
    const left = a ?? [];
    const right = b ?? [];

    return left.length === right.length && left.every((value, index) => value === right[index]);
};

const useUsersOptions = (initialUsers = [], pageSize = 100) => {
    const [users, setUsers] = useState([]);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: QUERY_KEYS.USERS.ROOT,
        queryFn: ({ pageParam = 0 }) =>
            fetchUsers({
                filter: [
                    {
                        field: "deleted_at",
                        operator: "null",
                        type: "AND",
                        value: "null",
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
    });

    const usersOptions = useMemo(() => {
        if (!data?.pages) return [];

        return data.pages
            .flatMap((page) => page.data || [])
            .map((item) => ({
                label: `${item.nombres} ${item.apellido1 ?? ""} ${item.apellido2 ?? ""}`.trim(),
                value: item.id,
            }))
            .filter((option) => option.value !== undefined);
    }, [data]);

    const onSearch = useCallback(
        async (searchQuery) => {
            const response = await fetchUsers({
                filter: [
                    {
                        field: "deleted_at",
                        operator: "null",
                        type: "AND",
                        value: "null",
                    },
                    {
                        groupType: "AND",
                        filters: [
                            { field: "nombres", operator: "ilike", type: "OR", value: searchQuery },
                            { field: "apellido1", operator: "ilike", type: "OR", value: searchQuery },
                            { field: "apellido2", operator: "ilike", type: "OR", value: searchQuery },
                        ],
                    },
                ],
                limit: pageSize,
                offset: 0,
            });

            return (response.data || [])
                .map((item) => ({
                    label: `${item.nombres} ${item.apellido1 ?? ""} ${item.apellido2 ?? ""}`.trim(),
                    value: item.id,
                }))
                .filter((option) => option.value !== undefined);
        },
        [pageSize],
    );

    useEffect(() => {
        setUsers((prev) => (arraysEqual(prev, initialUsers) ? prev : initialUsers));
    }, [initialUsers]);

    return {
        users,
        setUsers,
        usersOptions,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        onSearch,
    };
};

export default useUsersOptions;
