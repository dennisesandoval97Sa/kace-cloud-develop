import { useMemo } from "react";
import { genericSearchService } from "@/services/genericSearchService";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import useApiMetaData from "@/hooks/useApiMetaData";
import useDebounced from "@/hooks/useDebounced";
import { stringify } from "yaml";
import { replacer } from "../utils/repalcer";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 10;

const useChangeHistory = (passedId) => {
    const { t } = useTranslation();
    const { id, caseId } = useParams();
    const { urlHistory } = useApiMetaData();

    const entityId = passedId ?? id ?? caseId ?? null;

    const { data, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
        queryKey: ["changeHistory", entityId],
        queryFn: async ({ pageParam = 0 }) => {
            const data = await genericSearchService(
                `${urlHistory}/${entityId}/history`,
                [],
                {
                    limit: PAGE_SIZE,
                    offset: pageParam * PAGE_SIZE,
                },
                null,
                false,
                null,
                {
                    field: "created_at",
                    direction: "desc",
                },
            );
            return data;
        },
        getNextPageParam: (lastPage, allPages) => {
            const totalPages = Math.ceil(lastPage.total / PAGE_SIZE);
            const currentPage = allPages.length;

            if (currentPage < totalPages) {
                return currentPage;
            }

            return undefined;
        },
        initialPageParam: 0,
        enabled: Boolean(entityId),
        staleTime: 0,
        gcTime: 0,
        retry: 1,
    });

    const historyData = useMemo(() => {
        if (!data?.pages.length) {
            return [];
        }

        const response = [];

        const allItems = data.pages.flatMap(({ data }) => data) || [];

        for (const item of allItems) {
            const { id, changed_attributes, new_attributes, original_attributes, creator_name } = item;
            const unknownCreator = t("app.text.unknown");
            const createdAttribute = t("app.title.created");

            if (!new_attributes) continue;

            const formatValue = (val) => {
                if (val === null || val === undefined) return null;
                return stringify(val, replacer);
            };

            const { created_at, updated_at } = new_attributes;
            const excludedKeys = ["updated_at", "updated_by"];
            const isCreated = !changed_attributes || Object.keys(changed_attributes).length === 0;

            if (isCreated) {
                response.push({
                    id,
                    attribute: createdAttribute,
                    updated_at: created_at ? new Date(created_at).toLocaleString() : null,
                    updated_by: creator_name || unknownCreator,
                    changed_attribute: formatValue(new_attributes),
                    changed_attribute_type: "json",
                    original_attribute: formatValue({}),
                    original_attribute_type: "json",
                });
                continue;
            }

            for (const [key, value] of Object.entries(changed_attributes)) {
                if (excludedKeys.includes(key)) continue;

                const original_attribute_value = original_attributes?.[key];

                response.push({
                    id,
                    attribute: key,
                    updated_at: updated_at ? new Date(updated_at).toLocaleString() : null,
                    updated_by: creator_name || unknownCreator,
                    changed_attribute: formatValue(value),
                    changed_attribute_type: typeof value === "string" ? "string" : "json",
                    original_attribute: formatValue(original_attribute_value),
                    original_attribute_type: typeof original_attribute_value === "string" ? "string" : "json",
                });
            }
        }

        return response;
    }, [data]);

    const debouncedOnFetch = useDebounced(() => {
        fetchNextPage();
    }, 600);

    return { historyData, refetch, fetchNextPage, debouncedOnFetch, hasNextPage, isFetchingNextPage, status };
};

export default useChangeHistory;
