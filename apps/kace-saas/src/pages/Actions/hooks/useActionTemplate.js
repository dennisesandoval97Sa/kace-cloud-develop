import { useCallback, useMemo } from "react";
import { apiService } from "@kace/utils";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LIMIT_PAG } from "@/services/genericSearch";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const useTemplates = () => {
    const {
        data: templatesPages,
        isLoading: isLoadingTemplates,
        fetchNextPage: fetchNextTemplates,
        hasNextPage: hasNextPageTemplates,
        isFetchingNextPage: isFetchingNextPageTemplates,
    } = useInfiniteQuery({
        queryKey: ["actionTemplates"],
        queryFn: async ({ pageParam = 0 }) => {
            const data = await apiService.post(`${URL_AND_KEYS.templates.url}/search`, {
                filter: [
                    {
                        field: "deleted_at",
                        operator: "null",
                        type: "AND",
                        value: "null",
                    },
                ],
                limit: LIMIT_PAG,
                offset: pageParam * LIMIT_PAG,
                order: {
                    direction: "desc",
                    field: "created_at",
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

    const templatesOptions = useMemo(() => {
        if (!templatesPages?.pages) return [];

        return templatesPages.pages
            .flatMap((page) => page?.data || [])
            .map((item) => ({
                label: item?.name || item?.descripcion || "",
                value: item?.id,
            }))
            .filter((item) => item.value != null);
    }, [templatesPages]);

    const onSearchTemplates = useCallback(async (searchQuery) => {
        const data = await apiService.post(`${URL_AND_KEYS.templates.url}/search`, {
            filter: [
                {
                    field: "deleted_at",
                    operator: "null",
                    type: "AND",
                    value: "null",
                },
                {
                    field: "descripcion",
                    operator: "ilike",
                    type: "AND",
                    value: searchQuery,
                },
            ],
            limit: 0,
            offset: 0,
        });

        const response = parseResponseApi(data);

        return (response.data || []).map((item) => ({
            label: item?.name || item?.descripcion || "",
            value: item?.id,
        }));
    }, []);

    return {
        templatesOptions,
        isLoadingTemplates,
        fetchNextTemplates,
        hasNextPageTemplates,
        isFetchingNextPageTemplates,
        onSearchTemplates,
    };
};
