import { useMemo, useState } from "react";
import { apiService } from "@kace/utils";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LIMIT_PAG } from "@/services/genericSearch";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const useGroupsUser = () => {
    const [searchTerm, setSearchTerm] = useState("");

    const {
        data: groupsPages,
        isLoading: isLoadingGroups,
        fetchNextPage: fetchNextGroups,
        hasNextPage: hasNextPageGroups,
        isFetchingNextPage: isFetchingNextPageGroups,
    } = useInfiniteQuery({
        queryKey: ["userGroups", searchTerm],
        queryFn: async ({ pageParam = 0 }) => {
            const filter = searchTerm ? [{ field: "nombre", operator: "ilike", type: "AND", value: searchTerm }] : [];

            const data = await apiService.post(`${URL_AND_KEYS.groups.url}/search`, {
                filter,
                limit: LIMIT_PAG,
                offset: pageParam * LIMIT_PAG,
                order: {
                    direction: "asc",
                    field: "nombre",
                },
            });

            return parseResponseApi(data);
        },
        getNextPageParam: ({ total }, allPages) => {
            const totalPages = Math.ceil((total || 0) / LIMIT_PAG);
            const currentPage = allPages.length;
            return currentPage < totalPages ? currentPage : undefined;
        },
    });

    const groupsOptions = useMemo(() => {
        if (!groupsPages?.pages) return [];

        return groupsPages.pages
            .flatMap((page) => page?.data || [])
            .map((item) => ({
                id: item?.id,
                label: item?.nombre || "",
                value: item?.nombre || "",
            }))
            .filter((item) => item.id != null);
    }, [groupsPages]);

    return {
        groupsOptions,
        isLoadingGroups,
        fetchNextGroups,
        hasNextPageGroups,
        isFetchingNextPageGroups,
        onSearchGroups: setSearchTerm,
    };
};
