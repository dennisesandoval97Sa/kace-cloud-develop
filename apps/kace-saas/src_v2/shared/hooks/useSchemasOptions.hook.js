import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchSchemas } from "@kace_v2/shared/services/schemas.services";
import { useCallback, useEffect, useMemo, useState } from "react";

const useSchemasOptions = (initialSchemas = [], pageSize = 100) => {
    const [schemas, setSchemas] = useState([]);

    const ensureIds = useMemo(() => {
        const ids = Array.isArray(initialSchemas) ? initialSchemas : initialSchemas ? [initialSchemas] : [];
        return ids.filter((id) => id !== undefined && id !== null && id !== "");
    }, [initialSchemas]);

    const { data: ensureData } = useQuery({
        queryKey: [...QUERY_KEYS.SCHEMAS.ROOT, "ensure", ensureIds],
        queryFn: () =>
            fetchSchemas({
                filter:
                    ensureIds.length === 1
                        ? [
                              { field: "deleted_at", operator: "null", type: "AND", value: "null" },
                              { field: "id", operator: "eq", type: "AND", value: ensureIds[0] },
                          ]
                        : [
                              { field: "deleted_at", operator: "null", type: "AND", value: "null" },
                              { field: "id", operator: "in", type: "AND", value: ensureIds },
                          ],
                limit: ensureIds.length,
                offset: 0,
            }),
        enabled: ensureIds.length > 0,
        staleTime: 0,
        gcTime: 0,
    });

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: QUERY_KEYS.SCHEMAS.ROOT,
        queryFn: ({ pageParam = 0 }) =>
            fetchSchemas({
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

    const schemasOptions = useMemo(() => {
        const ensureOptions = (ensureData?.data || []).map((item) => ({
            label: item.name,
            value: item.id,
        }));

        const pageOptions = data?.pages
            ? data.pages
                  .flatMap((page) => page.data || [])
                  .map((item) => ({ label: item.name, value: item.id }))
                  .filter((option) => option.value !== undefined)
            : [];

        const pageIds = new Set(pageOptions.map((o) => String(o.value)));
        const merged = [...ensureOptions.filter((o) => !pageIds.has(String(o.value))), ...pageOptions];

        return merged;
    }, [data, ensureData]);

    const onSearch = useCallback(async (searchQuery) => {
        const response = await fetchSchemas({
            filter: [
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

        return response.data.map((item) => ({
            label: item.name,
            value: item.id,
        }));
    }, []);

    useEffect(() => {
        setSchemas(Array.isArray(initialSchemas) ? initialSchemas : initialSchemas ? [initialSchemas] : []);
    }, [initialSchemas]);

    return {
        schemas,
        setSchemas,
        schemasOptions,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        onSearch,
    };
};

export default useSchemasOptions;
