import { useCallback, useMemo } from "react";
import { apiService } from "@kace/utils";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LIMIT_PAG } from "@/services/genericSearch";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const typeForm = (data) => {
    try {
        const items = Array.isArray(data) ? data : [];

        const filtered = items.filter((item) => {
            const n = (item?.name ?? "").toLowerCase();
            return n !== "cases" && n !== "clients";
        });

        return filtered.map((item) => ({
            label: item?.name ?? "",
            value: item?.id,
            schema_id: item?.schema_id,
        }));
    } catch (_) {
        return [];
    }
};

export const useAuxDefinitions = () => {
    const {
        data: auxPages,
        isLoading: isLoadingAux,
        fetchNextPage: fetchNextAux,
        hasNextPage: hasNextPageAux,
        isFetchingNextPage: isFetchingNextPageAux,
    } = useInfiniteQuery({
        queryKey: ["auxDefinitionsForExportImport"],
        queryFn: async ({ pageParam = 0 }) => {
            const data = await apiService.post(`${URL_AND_KEYS.auxDefinitions.url}/search`, {
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

            const parsed = parseResponseApi(data);
            return parsed;
        },
        getNextPageParam: (lastPage, allPages) => {
            const total = lastPage?.total || 0;
            const totalPages = Math.ceil(total / LIMIT_PAG);
            const currentPage = allPages?.length;
            return currentPage < totalPages ? currentPage : undefined;
        },
    });

    const auxOptions = useMemo(() => {
        if (!auxPages?.pages) return [];

        return typeForm(auxPages.pages.flatMap((page) => page?.data || []));
    }, [auxPages]);

    const onSearchAux = useCallback(async (searchQuery) => {
        const data = await apiService.post(`${URL_AND_KEYS.auxDefinitions.url}/search`, {
            filter: [
                {
                    field: "deleted_at",
                    operator: "null",
                    type: "AND",
                    value: "null",
                },
                {
                    field: "name",
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
            label: item?.name || "",
            value: item?.id,
            schema_id: item?.schema_id,
        }));
    }, []);

    return {
        auxOptions,
        isLoadingAux,
        fetchNextAux,
        hasNextPageAux,
        isFetchingNextPageAux,
        onSearchAux,
    };
};
