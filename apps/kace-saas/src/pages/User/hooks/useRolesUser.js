import { useCallback, useMemo } from "react";
import { apiService } from "@kace/utils";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";
import { useInfiniteQuery } from "@tanstack/react-query";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const ROLES_LOOKUP_PAGE_SIZE = 25;

export const useRolesUser = () => {
    const {
        data: rolesPages,
        isLoading: isLoadingRoles,
        fetchNextPage: fetchNextRoles,
        hasNextPage: hasNextPageRoles,
        isFetchingNextPage: isFetchingNextPageRoles,
    } = useInfiniteQuery({
        queryKey: ["userRoles"],
        queryFn: async ({ pageParam = 0 }) => {
            const data = await apiService.post(`${URL_AND_KEYS.roles.url}/search`, {
                filter: [],
                limit: ROLES_LOOKUP_PAGE_SIZE,
                offset: pageParam * ROLES_LOOKUP_PAGE_SIZE,
                order: {
                    direction: "asc",
                    field: "descripcion",
                },
            });

            return parseResponseApi(data);
        },
        getNextPageParam: ({ total }, allPages) => {
            const totalPages = Math.ceil((total || 0) / ROLES_LOOKUP_PAGE_SIZE);
            const currentPage = allPages.length;
            return currentPage < totalPages ? currentPage : undefined;
        },
    });

    const rolesOptions = useMemo(() => {
        if (!rolesPages?.pages) return [];

        return rolesPages.pages
            .flatMap((page) => page?.data || [])
            .map((item) => ({
                id: item?.id,
                label: item?.descripcion || "",
                value: item?.id,
            }))
            .filter((item) => item.value != null);
    }, [rolesPages]);

    const onSearchRoles = useCallback(async (searchQuery) => {
        const data = await apiService.post(`${URL_AND_KEYS.roles.url}/search`, {
            filter: [
                {
                    field: "descripcion",
                    operator: "ilike",
                    type: "AND",
                    value: searchQuery,
                },
            ],
            limit: ROLES_LOOKUP_PAGE_SIZE,
            offset: 0,
        });

        const response = parseResponseApi(data);

        return (response.data || []).map((item) => ({
            label: item?.descripcion || "",
            value: item?.id,
        }));
    }, []);

    return {
        rolesOptions,
        isLoadingRoles,
        fetchNextRoles,
        hasNextPageRoles,
        isFetchingNextPageRoles,
        onSearchRoles,
    };
};
