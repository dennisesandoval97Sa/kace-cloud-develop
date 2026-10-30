import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { genericSearch } from "@/services/genericSearch";
import { REL_USERS_GROUP_SERVICE } from "@/utils/URL";

const PAGE_SIZE = 100;

const fetchUserGroupRelationshipsPage = async ({ usuarioId, limit, offset }) => {
    return genericSearch(
        `${REL_USERS_GROUP_SERVICE}/search`,
        [
            {
                field: "usuario_id",
                operator: "eq",
                value: usuarioId,
                type: "AND",
            },
        ],
        { limit, offset },
        null,
        false,
    );
};

const useBoardBulkUserGroupsOptions = (usuarioId, enabled = true) => {
    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ["user-group-relationships", "board-bulk", usuarioId],
        queryFn: ({ pageParam = 0 }) =>
            fetchUserGroupRelationshipsPage({
                usuarioId,
                limit: PAGE_SIZE,
                offset: pageParam * PAGE_SIZE,
            }),
        getNextPageParam: (lastPage, allPages) => {
            const items = lastPage?.data || [];
            if (items.length < PAGE_SIZE) return undefined;
            return allPages.length;
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        enabled: Boolean(usuarioId) && enabled,
    });

    const groupsOptions = useMemo(() => {
        if (!data?.pages) return [];

        return data.pages
            .flatMap((page) => page.data || [])
            .map((item) => ({
                label: item.grupo?.nombres ?? item.grupo?.nombre ?? String(item.grupo_id ?? ""),
                value: String(item.grupo_id),
            }))
            .filter((option) => option.value !== undefined && option.value !== "");
    }, [data]);

    return {
        groupsOptions,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    };
};

export default useBoardBulkUserGroupsOptions;
