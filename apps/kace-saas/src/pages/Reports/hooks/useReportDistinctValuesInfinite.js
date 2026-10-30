import { useInfiniteQuery } from "@tanstack/react-query";

import { apiService } from "@kace/utils";

const PAGE_SIZE = 50;

/**
 * Normaliza la respuesta del endpoint de valores distintos.
 * Sigue la convención del proyecto: { data: { items }, metadata: { count } }
 */
const parseResponse = (response) => {
    const items = response?.data?.data?.items ?? [];
    const total = response?.data?.metadata?.count ?? 0;
    return { data: items, total };
};

/**
 * Hook para obtener valores únicos de un campo en una vista de reporte con paginación infinita y búsqueda.
 * Usa la convención del proyecto: total en metadata.count, pageParam como número de página.
 * @param {string|null} reportName - Nombre del reporte/vista (null para deshabilitar)
 * @param {string|null} fieldName - Nombre del campo a consultar (null para deshabilitar)
 * @param {string} search - Término de búsqueda
 */
export const useReportDistinctValuesInfinite = (reportName, fieldName, search = "") => {
    return useInfiniteQuery({
        queryKey: ["report-distinct-values-infinite", reportName, fieldName, search],
        queryFn: async ({ pageParam = 0 }) => {
            const params = new URLSearchParams({
                name: reportName,
                field: fieldName,
                limit: String(PAGE_SIZE),
                offset: String(pageParam * PAGE_SIZE),
            });
            if (search) {
                params.set("search", search);
            }
            const response = await apiService.post(`/reports/advance-search?${params.toString()}`, {});
            return parseResponse(response);
        },
        getNextPageParam: ({ total }, allPages) => {
            const totalPages = Math.ceil((total || 0) / PAGE_SIZE);
            const currentPage = allPages.length;
            return currentPage < totalPages ? currentPage : undefined;
        },
        initialPageParam: 0,
        enabled: !!reportName && !!fieldName,
        staleTime: 1000 * 60 * 5,
    });
};
