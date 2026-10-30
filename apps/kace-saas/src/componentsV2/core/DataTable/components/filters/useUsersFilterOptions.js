import { useMemo, useState } from "react";
import { apiService } from "@kace/utils";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";
import { fetchUsers } from "@kace_v2/shared/services/users.service";
import { useInfiniteQuery } from "@tanstack/react-query";
import useDebounced from "@/hooks/useDebounced";
import { LIMIT_PAG } from "@/services/genericSearch";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const USERS_BASE_FILTER = {
    field: "usuarios.deleted_at",
    operator: "null",
    value: "null",
    type: "AND",
};

const mapUserOption = (item) => {
    const fullName = [item?.nombres, item?.apellido1, item?.apellido2].filter(Boolean).join(" ").trim();
    return {
        id: item?.id,
        label: fullName || item?.login || "",
        value: item?.id,
    };
};

export const useUsersFilterOptions = () => {
    const [queryTerm, setQueryTerm] = useState("");
    const onSearchUsers = useDebounced(setQueryTerm, 400);

    const {
        data: usersPages,
        isLoading: isLoadingUsers,
        fetchNextPage: fetchNextUsers,
        hasNextPage: hasNextPageUsers,
        isFetchingNextPage: isFetchingNextPageUsers,
    } = useInfiniteQuery({
        queryKey: ["dataTableUsersFilter", queryTerm],
        initialPageParam: 0,
        staleTime: 60_000,
        queryFn: async ({ pageParam }) => {
            if (queryTerm) {
                const data = await apiService.post(`${URL_AND_KEYS.users.url}/searchByName`, {
                    name: queryTerm,
                });
                return parseResponseApi(data);
            }

            return fetchUsers({
                filter: [USERS_BASE_FILTER],
                limit: LIMIT_PAG,
                offset: pageParam * LIMIT_PAG,
                order: {
                    direction: "asc",
                    field: "nombres",
                },
            });
        },
        getNextPageParam: ({ total }, allPages) => {
            if (queryTerm) return undefined;
            const totalPages = Math.ceil((total || 0) / LIMIT_PAG);
            const currentPage = allPages.length;
            return currentPage < totalPages ? currentPage : undefined;
        },
    });

    const usersOptions = useMemo(() => {
        if (!usersPages?.pages) return [];

        return usersPages.pages
            .flatMap((page) => page?.data || [])
            .map(mapUserOption)
            .filter((item) => item.id != null);
    }, [usersPages]);

    return {
        usersOptions,
        isLoadingUsers,
        fetchNextUsers,
        hasNextPageUsers,
        isFetchingNextPageUsers,
        onSearchUsers,
    };
};
