import { useMemo } from "react";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const TEXT_SEARCH_FIELDS = [
    "nivel1",
    "nivel2",
    "nivel3",
    "nivel4",
    "nivel5",
    "nivel6",
    "nivel7",
    "nivel8",
    "nivel9",
    "nivel10",
    "nombres",
    "login",
];

const buildSearchFilters = (normalizedSearchTerm) => {
    if (!normalizedSearchTerm) return [];

    const filters = TEXT_SEARCH_FIELDS.map((field) => ({
        field,
        operator: "ilike",
        value: normalizedSearchTerm,
        type: "OR",
    }));

    if (/^\d+$/.test(normalizedSearchTerm)) {
        filters.unshift({
            field: "reference",
            operator: "eq",
            value: normalizedSearchTerm,
            type: "OR",
        });
    }

    return [
        {
            groupType: "AND",
            filters,
        },
    ];
};

export const useInteractionCaseSearch = ({
    clientId,
    searchTerm = "",
    page = 1,
    pageSize = 20,
    excludedCaseIds = [],
    enabled = true,
}) => {
    const normalizedSearchTerm = (searchTerm ?? "").trim();
    const normalizedExcludedIds = (excludedCaseIds ?? []).filter(Boolean).join(",");
    const filters = useMemo(() => {
        const baseFilters = [
            { field: "cliente_id", operator: "eq", value: clientId, type: "AND" },
            { field: "fecha_resolucion", operator: "null", value: "null", type: "AND" },
        ];

        if (normalizedExcludedIds) {
            baseFilters.push({ field: "id", operator: "notIn", value: normalizedExcludedIds, type: "AND" });
        }

        return [...baseFilters, ...buildSearchFilters(normalizedSearchTerm)];
    }, [clientId, normalizedExcludedIds, normalizedSearchTerm]);

    const pagination = useMemo(() => ({ limit: pageSize, offset: Math.max(page - 1, 0) * pageSize }), [page, pageSize]);

    return useGenericSearchQuery({
        url: `${URL_AND_KEYS.interactions.associate}/candidates/search`,
        keyQuery: ["interaction-case-search", clientId, normalizedSearchTerm, page, pageSize, normalizedExcludedIds],
        filter: filters,
        pagination,
        enabled: Boolean(clientId) && enabled,
        select: (data) => ({
            items: Array.isArray(data?.data) ? data.data : [],
            total: Number(data?.total ?? data?.metadata?.count ?? data?.count ?? 0),
        }),
    });
};
