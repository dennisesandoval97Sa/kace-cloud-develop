import { useInfiniteQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchUsers } from "@kace_v2/shared/services/users.service";
import { useCallback, useMemo } from "react";
import { formatLastSeenAtForFilter } from "@kace_v2/features/boards/utils/boardCasesBulk.utils";

const PAGE_SIZE = 100;

const buildExtraFilters = (reassignFilterActive, sessionTimeframe, includeDefaultAssignees = false) => {
    if (!reassignFilterActive) return [];
    const lastSeenCutoff = formatLastSeenAtForFilter(new Date(Date.now() - sessionTimeframe));

    const activeFilter = {
        field: "last_seen_at",
        operator: "gte",
        value: lastSeenCutoff,
        type: "AND",
    };

    if (includeDefaultAssignees) {
        return [
            {
                groupType: "AND",
                filters: [
                    { ...activeFilter, type: "AND" },
                    { field: "codigos_externos", operator: "jsonArrayValue", value: "DEFAULT_ASSIGNEE", type: "OR" },
                ],
            },
        ];
    }

    return [activeFilter];
};

const useBoardBulkAssignableUsersOptions = ({
    enabled = true,
    reassignFilterActive = false,
    includeDefaultAssignees = false,
    sessionTimeframe = 0,
}) => {
    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: [
            ...QUERY_KEYS.USERS.ROOT,
            "board-bulk-assign",
            reassignFilterActive ? "active-session" : "all",
            includeDefaultAssignees ? "include-default" : "no-default",
        ],
        queryFn: ({ pageParam = 0 }) => {
            const extraFilters = buildExtraFilters(reassignFilterActive, sessionTimeframe, includeDefaultAssignees);
            return fetchUsers({
                filter: [
                    {
                        field: "deleted_at",
                        operator: "null",
                        type: "AND",
                        value: "null",
                    },
                    {
                        field: "is_active",
                        operator: "eq",
                        type: "AND",
                        value: "1",
                    },
                    ...extraFilters,
                ],
                limit: PAGE_SIZE,
                offset: pageParam * PAGE_SIZE,
            });
        },
        getNextPageParam: ({ count, total }, allPages) => {
            const totalPages = Math.ceil(total / PAGE_SIZE);
            const currentPage = allPages.length;

            if (currentPage < totalPages) {
                return currentPage;
            }

            return undefined;
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        enabled,
    });

    const usersOptions = useMemo(() => {
        if (!data?.pages) return [];

        return data.pages
            .flatMap((page) => page.data || [])
            .map((item) => ({
                label: `${item.nombres} ${item.apellido1 ?? ""} ${item.apellido2 ?? ""}`.trim(),
                value: String(item.id),
            }))
            .filter((option) => option.value !== undefined);
    }, [data]);

    const onSearch = useCallback(
        async (searchQuery) => {
            const extraFilters = buildExtraFilters(reassignFilterActive, sessionTimeframe, includeDefaultAssignees);
            const tokens = searchQuery.trim().split(/\s+/).filter(Boolean);
            const tokenGroups = tokens.map((token) => ({
                groupType: "AND",
                filters: [
                    { field: "nombres", operator: "ilike", type: "AND", value: token },
                    { field: "apellido1", operator: "ilike", type: "OR", value: token },
                    { field: "apellido2", operator: "ilike", type: "OR", value: token },
                ],
            }));
            const response = await fetchUsers({
                filter: [
                    ...extraFilters,
                    {
                        field: "deleted_at",
                        operator: "null",
                        type: "AND",
                        value: "null",
                    },
                    {
                        field: "is_active",
                        operator: "eq",
                        type: "AND",
                        value: "1",
                    },
                    ...tokenGroups,
                ],
                limit: PAGE_SIZE,
                offset: 0,
            });

            return response.data.map((item) => ({
                label: `${item.nombres} ${item.apellido1 ?? ""} ${item.apellido2 ?? ""}`.trim(),
                value: String(item.id),
            }));
        },
        [reassignFilterActive, includeDefaultAssignees, sessionTimeframe],
    );

    return {
        usersOptions,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        onSearch,
    };
};

export default useBoardBulkAssignableUsersOptions;
